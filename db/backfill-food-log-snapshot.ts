/**
 * One-off backfill for app.food_log's nutrition snapshot columns (0013_food_nutrition_overlay.sql),
 * part of Phase 5 of the food-nutrition audit. Unlike db/audit-food-data.ts and db/recalc-recipes.ts,
 * this script DOES write - it's the one Phase 5 deliverable that's explicitly a write, not a dry
 * run (docs/FOOD_DATA_MIGRATION.md section 2.3's "backfill must run... before any correction is
 * applied" step). Defaults to a dry run; pass --write to actually UPDATE.
 *
 * Re-implements (does not import) the exact same resolution apps/api/src/food-log/food-log.service.ts's
 * `resolveFreshNutrition`/`buildLookups` use - db/ scripts can't cleanly import apps/api's compiled
 * services (NodeNext vs this package's Bundler module resolution, and apps/api isn't packaged as an
 * importable library - the same cross-package friction CLAUDE.md's "Known trap" section documents
 * for packages/shared, except apps/api has no dual-entry-point fix for it). Since no
 * app.food_nutrition correction exists yet (confirmed: this script is meant to run immediately
 * after 0013's migration, before Phase 6), the numbers this produces are identical to what
 * `enrichWithMacros` already computes live today for every row - this backfill only moves them
 * from "computed on every read" to "computed once, stored" for CLAUDE.md's historical-integrity
 * requirement (docs/FOOD_DATABASE_AUDIT.md finding #10). Deliberately NOT idempotent against a
 * future correction: re-running this script after a real app.food_nutrition row exists would
 * overwrite a row's snapshot with the pre-correction value again, exactly what the snapshot
 * design exists to prevent - this script is meant to run exactly once, right after the migration,
 * for pre-existing rows only.
 *
 * Does NOT touch updated_at/server_updated_at (critical: bumping either would make every
 * pre-existing row look freshly modified to the /sync cursor, breaking incremental pull for every
 * existing client).
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm backfill:food-log-snapshot [--write]
 */
import { Client } from "pg";

interface FoodLogRow {
  id: string;
  food_source: string;
  food_ref: string;
  quantity: string;
  unit: string;
}

interface NutrientSummary {
  name: string;
  kcalPer100g: number | null;
  proteinGPer100g: number | null;
  fatGPer100g: number | null;
  carbGPer100g: number | null;
  servingGramsByName: Record<string, number>;
}

interface MacroBreakdown {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

type Confidence = "verified" | "calculated" | "estimated" | "unverified";

function resolveGrams(quantity: number, unit: string, servingGramsByName: Record<string, number>): number | null {
  if (unit === "g" || unit === "ml") return quantity;
  const gramsPerUnit = servingGramsByName[unit];
  return gramsPerUnit === undefined ? null : quantity * gramsPerUnit;
}

function computeMacros(grams: number | null, summary: NutrientSummary): MacroBreakdown | null {
  if (grams === null) return null;
  const scale = grams / 100;
  const scaleOrNull = (per100g: number | null) => (per100g === null ? null : Math.round(per100g * scale * 10) / 10);
  return {
    kcal: scaleOrNull(summary.kcalPer100g),
    proteinG: scaleOrNull(summary.proteinGPer100g),
    fatG: scaleOrNull(summary.fatGPer100g),
    carbG: scaleOrNull(summary.carbGPer100g),
  };
}

async function getIndbNutrientSummaries(codes: string[], client: Client): Promise<Map<string, NutrientSummary>> {
  const byCode = new Map<string, NutrientSummary>();
  if (codes.length === 0) return byCode;

  const foodResult = await client.query<{ id: number; code: string; name: string }>(
    "SELECT id, code, name FROM food WHERE code = ANY($1)",
    [codes],
  );
  const idByCode = new Map(foodResult.rows.map((row) => [row.code, row.id]));
  const ids = [...idByCode.values()];
  if (ids.length === 0) return byCode;

  const byId = new Map<number, NutrientSummary>(
    foodResult.rows.map((row) => [
      row.id,
      { name: row.name, kcalPer100g: null, proteinGPer100g: null, fatGPer100g: null, carbGPer100g: null, servingGramsByName: {} },
    ]),
  );

  const [nutrientResult, servingResult] = await Promise.all([
    client.query<{ food_id: number; nutrient_code: string; per_100g: string | null }>(
      `SELECT fn.food_id, n.code AS nutrient_code, fn.per_100g
       FROM food_nutrient fn JOIN nutrient n ON n.id = fn.nutrient_id
       WHERE fn.food_id = ANY($1)`,
      [ids],
    ),
    client.query<{ food_id: number; name: string; grams: string | null }>(
      "SELECT food_id, name, grams FROM serving_measure WHERE food_id = ANY($1)",
      [ids],
    ),
  ]);
  for (const row of nutrientResult.rows) {
    const summary = byId.get(row.food_id);
    if (!summary) continue;
    const value = row.per_100g === null ? null : Number(row.per_100g);
    if (row.nutrient_code === "energy_kcal") summary.kcalPer100g = value;
    else if (row.nutrient_code === "protein_g") summary.proteinGPer100g = value;
    else if (row.nutrient_code === "fat_g") summary.fatGPer100g = value;
    else if (row.nutrient_code === "carb_g") summary.carbGPer100g = value;
  }
  for (const row of servingResult.rows) {
    const summary = byId.get(row.food_id);
    if (summary && row.grams !== null) summary.servingGramsByName[row.name] = Number(row.grams);
  }

  for (const [code, id] of idByCode) {
    const summary = byId.get(id);
    if (summary) byCode.set(code, summary);
  }
  return byCode;
}

interface CustomFoodResolution {
  macros: MacroBreakdown | null;
  confidence: "calculated" | "estimated" | null;
}

async function getCustomFoodResolutions(
  customFoodIds: string[],
  grams: number,
  client: Client,
): Promise<Map<string, CustomFoodResolution>> {
  const byId = new Map<string, CustomFoodResolution>();
  if (customFoodIds.length === 0) return byId;

  const ingredientResult = await client.query<{
    custom_food_id: string;
    food_source: string;
    food_ref: string;
    quantity_g: string;
  }>(
    `SELECT custom_food_id, food_source, food_ref, quantity_g FROM app.custom_food_ingredient
     WHERE custom_food_id = ANY($1) AND is_deleted = false`,
    [customFoodIds],
  );

  const indbRefs = [...new Set(ingredientResult.rows.filter((r) => r.food_source === "indb").map((r) => r.food_ref))];
  const summaryByCode = await getIndbNutrientSummaries(indbRefs, client);

  const byCustomFoodId = new Map<string, typeof ingredientResult.rows>();
  for (const row of ingredientResult.rows) {
    const list = byCustomFoodId.get(row.custom_food_id) ?? [];
    list.push(row);
    byCustomFoodId.set(row.custom_food_id, list);
  }

  for (const customFoodId of customFoodIds) {
    const ingredients = byCustomFoodId.get(customFoodId) ?? [];
    let totalGrams = 0;
    let kcal = 0, proteinG = 0, fatG = 0, carbG = 0;
    let hasKnown = false, hasUnknown = false;
    for (const ingredient of ingredients) {
      const ingredientGrams = Number(ingredient.quantity_g);
      totalGrams += ingredientGrams;
      const summary = ingredient.food_source === "indb" ? summaryByCode.get(ingredient.food_ref) : undefined;
      if (!summary) { hasUnknown = true; continue; }
      hasKnown = true;
      const scale = ingredientGrams / 100;
      kcal += (summary.kcalPer100g ?? 0) * scale;
      proteinG += (summary.proteinGPer100g ?? 0) * scale;
      fatG += (summary.fatGPer100g ?? 0) * scale;
      carbG += (summary.carbGPer100g ?? 0) * scale;
    }
    if (hasKnown && totalGrams > 0) {
      const scaled = (perGram: number) => Math.round(perGram * grams * 10) / 10;
      byId.set(customFoodId, {
        macros: {
          kcal: scaled(kcal / totalGrams),
          proteinG: scaled(proteinG / totalGrams),
          fatG: scaled(fatG / totalGrams),
          carbG: scaled(carbG / totalGrams),
        },
        confidence: hasUnknown ? "estimated" : "calculated",
      });
    } else {
      byId.set(customFoodId, { macros: null, confidence: null });
    }
  }
  return byId;
}

interface PackagedFoodResolution {
  macros: MacroBreakdown | null;
  confidence: Confidence | null;
}

async function getPackagedFoodResolutions(
  packagedIds: string[],
  gramsById: Map<string, number>,
  client: Client,
): Promise<Map<string, PackagedFoodResolution>> {
  const byId = new Map<string, PackagedFoodResolution>();
  if (packagedIds.length === 0) return byId;
  const result = await client.query<{
    id: string;
    nutrients: { energy_kcal: number | null; protein_g: number | null; fat_g: number | null; carb_g: number | null };
    confidence: Confidence | null;
  }>("SELECT id, nutrients, confidence FROM app.packaged_food WHERE id = ANY($1)", [packagedIds]);
  for (const row of result.rows) {
    const grams = gramsById.get(row.id) ?? 0;
    const scale = grams / 100;
    const scaled = (v: number | null) => (v === null ? null : Math.round(v * scale * 10) / 10);
    byId.set(row.id, {
      macros: {
        kcal: scaled(row.nutrients.energy_kcal),
        proteinG: scaled(row.nutrients.protein_g),
        fatG: scaled(row.nutrients.fat_g),
        carbG: scaled(row.nutrients.carb_g),
      },
      confidence: row.confidence ?? "unverified",
    });
  }
  return byId;
}

interface SnapshotUpdate {
  id: string;
  macros: MacroBreakdown | null;
  confidence: Confidence | null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const write = process.argv.includes("--write");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const rowsResult = await client.query<FoodLogRow>(
      "SELECT id, food_source, food_ref, quantity, unit FROM app.food_log WHERE kcal_snapshot IS NULL",
    );
    const rows = rowsResult.rows;
    console.log(`${rows.length} food_log row(s) with no snapshot yet.`);
    if (rows.length === 0) {
      console.log("Nothing to backfill.");
      return;
    }

    const indbRows = rows.filter((r) => r.food_source === "indb");
    const customRows = rows.filter((r) => r.food_source === "custom");
    const packagedRows = rows.filter((r) => r.food_source === "packaged");

    const indbSummaryByCode = await getIndbNutrientSummaries([...new Set(indbRows.map((r) => r.food_ref))], client);

    // A custom food's resolved macros depend on the logged grams (quantity is always grams of the
    // recipe, same v1 simplification food-log.service.ts documents), which can differ between two
    // food_log rows referencing the same custom_food_id - resolved per row rather than batched by
    // custom_food_id for that reason.
    const customResolutionByRowId = new Map<string, CustomFoodResolution>();
    for (const row of customRows) {
      const resolutions = await getCustomFoodResolutions([row.food_ref], Number(row.quantity), client);
      const resolution = resolutions.get(row.food_ref);
      if (resolution) customResolutionByRowId.set(row.id, resolution);
    }

    const packagedGramsById = new Map(packagedRows.map((r) => [r.food_ref, Number(r.quantity)]));
    const packagedResolutionByCode = await getPackagedFoodResolutions(
      [...new Set(packagedRows.map((r) => r.food_ref))],
      packagedGramsById,
      client,
    );

    const updates: SnapshotUpdate[] = [];

    for (const row of indbRows) {
      const summary = indbSummaryByCode.get(row.food_ref);
      if (!summary) {
        updates.push({ id: row.id, macros: null, confidence: null });
        continue;
      }
      const grams = resolveGrams(Number(row.quantity), row.unit, summary.servingGramsByName);
      const macros = computeMacros(grams, summary);
      updates.push({ id: row.id, macros, confidence: macros ? "verified" : null });
    }
    for (const row of customRows) {
      const resolution = customResolutionByRowId.get(row.id);
      updates.push({ id: row.id, macros: resolution?.macros ?? null, confidence: resolution?.confidence ?? null });
    }
    for (const row of packagedRows) {
      const resolution = packagedResolutionByCode.get(row.food_ref);
      updates.push({ id: row.id, macros: resolution?.macros ?? null, confidence: resolution?.confidence ?? null });
    }
    // Any other food_source (shouldn't exist given the CHECK constraint, but handled defensively
    // rather than silently dropped) gets no snapshot - stays null, falls back to live computation.

    const resolvedCount = updates.filter((u) => u.macros !== null).length;
    console.log(
      `Resolved ${resolvedCount}/${updates.length} rows to a real snapshot (the rest stay null - no data exists to resolve them, same as they'd show live today).`,
    );

    if (!write) {
      console.log("Dry run (pass --write to apply). Sample of what would be written:");
      console.log(JSON.stringify(updates.slice(0, 5), null, 2));
      return;
    }

    let applied = 0;
    for (const update of updates) {
      await client.query(
        `UPDATE app.food_log SET kcal_snapshot = $2, protein_g_snapshot = $3, fat_g_snapshot = $4, carb_g_snapshot = $5,
           nutrition_confidence = $6, nutrition_version = 0
         WHERE id = $1`,
        [
          update.id,
          update.macros?.kcal ?? null,
          update.macros?.proteinG ?? null,
          update.macros?.fatG ?? null,
          update.macros?.carbG ?? null,
          update.confidence,
        ],
      );
      applied += 1;
    }
    console.log(`Backfilled ${applied} row(s). updated_at/server_updated_at were not touched.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
