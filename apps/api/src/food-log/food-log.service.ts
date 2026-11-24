import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateFoodLogRequest, UpdateFoodLogRequest } from "@fitness-app/shared";
import { DatabaseService } from "../database/database.service.js";
import { FoodService, type FoodNutrientSummary } from "../food/food.service.js";
import { PackagedFoodService } from "../packaged-food/packaged-food.service.js";

/** Mirrors app.food_nutrition/app.food_log's `confidence`/`nutrition_confidence` CHECK constraint
 * (0013_food_nutrition_overlay.sql) - see docs/NUTRITION_CALCULATION_METHODOLOGY.md's tier table. */
export type NutritionConfidence = "verified" | "calculated" | "estimated" | "unverified";

interface FoodLogRow {
  id: string;
  account_id: string;
  food_source: string;
  food_ref: string;
  quantity: string;
  unit: string;
  meal_type: string;
  logged_at: Date;
  source: string;
  is_estimate: boolean;
  is_deleted: boolean;
  updated_at: Date;
  // Added by 0013_food_nutrition_overlay.sql - null on any row not yet backfilled
  // (db/backfill-food-log-snapshot.ts) or written before this migration existed. `SELECT *`
  // always returns these now, but they're optional here so a hand-built test row can omit them.
  kcal_snapshot?: string | null;
  protein_g_snapshot?: string | null;
  fat_g_snapshot?: string | null;
  carb_g_snapshot?: string | null;
  nutrition_confidence?: NutritionConfidence | null;
  nutrition_version?: number | null;
}

export interface MacroBreakdown {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

export interface FoodLogEntryWithMacros extends FoodLogRow {
  macros: MacroBreakdown | null;
  /** The food's display name, resolved fresh from food_source/food_ref every time (never stored
   * on app.food_log itself) - apps/mobile snapshots this locally as food_log.food_name so the
   * Today diary can show it without a lookup. Null if the referenced food/custom_food/
   * packaged_food can't be resolved (e.g. deleted server-side). */
  food_name: string | null;
}

export type { FoodLogRow };

/** What a fresh (non-snapshot) macro/name/confidence resolution produces for one row - returned by
 * `resolveFreshNutrition` and used both to build a live `FoodLogEntryWithMacros` (the historical
 * fallback path) and, by `computeNutritionSnapshot`, to decide what to persist into
 * app.food_log's own snapshot columns at write time. */
export interface ResolvedNutrition {
  macros: MacroBreakdown | null;
  food_name: string | null;
  /** Null exactly when macros is null - there's nothing to have a confidence about. */
  confidence: NutritionConfidence | null;
  /** Which app.food_nutrition version (if any) this resolution used - 0 when none (the common
   * case today: only ASC056 has a correction as of this writing). Null exactly when confidence is
   * null (nothing resolved at all). */
  version: number | null;
}

function resolveGrams(
  quantity: number,
  unit: string,
  servingGramsByName: Record<string, number>,
): number | null {
  if (unit === "g" || unit === "ml") {
    return quantity;
  }
  const gramsPerUnit = servingGramsByName[unit];
  return gramsPerUnit === undefined ? null : quantity * gramsPerUnit;
}

function computeMacros(
  grams: number | null,
  summary: { kcalPer100g: number | null; proteinGPer100g: number | null; fatGPer100g: number | null; carbGPer100g: number | null },
): MacroBreakdown | null {
  if (grams === null) {
    return null;
  }
  const scale = grams / 100;
  const scaleOrNull = (per100g: number | null) =>
    per100g === null ? null : Math.round(per100g * scale * 10) / 10;
  return {
    kcal: scaleOrNull(summary.kcalPer100g),
    proteinG: scaleOrNull(summary.proteinGPer100g),
    fatG: scaleOrNull(summary.fatGPer100g),
    carbG: scaleOrNull(summary.carbGPer100g),
  };
}

interface FoodNutritionOverlayRow {
  food_code: string;
  version: number;
  kcal_per_100g: string | null;
  protein_g_per_100g: string | null;
  fat_g_per_100g: string | null;
  carb_g_per_100g: string | null;
  confidence: NutritionConfidence;
}

/**
 * The highest-version app.food_nutrition row for each code, if a correction has ever been applied
 * (Phase 6 of docs/FOOD_DATABASE_CORRECTIONS.md - one correction, ASC056, is live as of this
 * writing; see db/apply-phase6-corrections.ts). The lookup covers both indb and packaged-food
 * codes (a correction isn't limited to indb data), so a future correction needs only an INSERT
 * into app.food_nutrition, never an app-code change, to take effect
 * (docs/FOOD_DATA_MIGRATION.md section 2.1's design). Not applied to custom-food ingredients - a
 * known v1 gap alongside the existing "nested custom/packaged sub-ingredients don't contribute"
 * limitation.
 */
async function getFoodNutritionOverlay(
  codes: string[],
  db: DatabaseService,
): Promise<Map<string, FoodNutritionOverlayRow>> {
  if (codes.length === 0) {
    return new Map();
  }
  const result = await db.query<FoodNutritionOverlayRow>(
    `SELECT DISTINCT ON (food_code) food_code, version, kcal_per_100g, protein_g_per_100g, fat_g_per_100g, carb_g_per_100g, confidence
     FROM app.food_nutrition
     WHERE food_code = ANY($1)
     ORDER BY food_code, version DESC`,
    [codes],
  );
  return new Map(result.rows.map((row) => [row.food_code, row]));
}

interface OverlayResolution {
  kcalPer100g: number | null;
  proteinGPer100g: number | null;
  fatGPer100g: number | null;
  carbGPer100g: number | null;
  confidence: NutritionConfidence;
  /** 0 when no correction exists for this code - matches `nutrition_version`'s baseline meaning
   * (docs/FOOD_DATA_MIGRATION.md section 2.3), never left as a stale hardcoded constant now that a
   * real correction (ASC056) actually exists and must be distinguishable from "no correction". */
  version: number;
}

/** Merges an app.food_nutrition overlay row onto a base per-100g profile, field by field. No
 * overlay ⇒ the base profile is used as-is, tagged `verified` (today's only tier for a direct
 * indb/USDA value) at version 0. */
function applyFoodNutritionOverlay(
  base: { kcalPer100g: number | null; proteinGPer100g: number | null; fatGPer100g: number | null; carbGPer100g: number | null },
  overlay: FoodNutritionOverlayRow | undefined,
): OverlayResolution {
  if (!overlay) {
    return { ...base, confidence: "verified", version: 0 };
  }
  return {
    kcalPer100g: overlay.kcal_per_100g !== null ? Number(overlay.kcal_per_100g) : base.kcalPer100g,
    proteinGPer100g: overlay.protein_g_per_100g !== null ? Number(overlay.protein_g_per_100g) : base.proteinGPer100g,
    fatGPer100g: overlay.fat_g_per_100g !== null ? Number(overlay.fat_g_per_100g) : base.fatGPer100g,
    carbGPer100g: overlay.carb_g_per_100g !== null ? Number(overlay.carb_g_per_100g) : base.carbGPer100g,
    confidence: overlay.confidence,
    version: overlay.version,
  };
}

interface CustomFoodIngredientRow {
  custom_food_id: string;
  food_source: string;
  food_ref: string;
  quantity_g: string;
}

interface CustomFoodMacros {
  perGram: MacroBreakdown;
  /** `estimated` when at least one ingredient's nutrients couldn't be resolved - its weight still
   * counted toward the per-gram average (see the loop below), so the true value is understated by
   * at least that much. This is a labeling-only change (docs/FOOD_DATABASE_AUDIT.md finding #8):
   * the numbers are unchanged from before this fix - only the confidence tier now tells the truth
   * about them, rather than every custom-food log implicitly claiming the same confidence
   * regardless of whether an ingredient was actually missing. */
  confidence: "calculated" | "estimated";
}

/** Per-gram-of-whole-recipe macros for each custom_food id that has at least one indb-sourced
 * ingredient with known nutrients. Nested custom/packaged sub-ingredients don't contribute (v1
 * limitation - same spirit as packaged-food/OFF integration being its own later milestone). */
async function computeCustomFoodMacros(
  customFoodIds: string[],
  food: FoodService,
  db: DatabaseService,
): Promise<Map<string, CustomFoodMacros>> {
  const byId = new Map<string, CustomFoodMacros>();
  if (customFoodIds.length === 0) {
    return byId;
  }

  const ingredients = await db.query<CustomFoodIngredientRow>(
    `SELECT custom_food_id, food_source, food_ref, quantity_g FROM app.custom_food_ingredient
     WHERE custom_food_id = ANY($1) AND is_deleted = false`,
    [customFoodIds],
  );

  const indbRefs = [
    ...new Set(ingredients.rows.filter((row) => row.food_source === "indb").map((row) => row.food_ref)),
  ];
  const summaryByCode = await food.getNutrientSummaries(indbRefs);

  const byCustomFoodId = new Map<string, CustomFoodIngredientRow[]>();
  for (const ingredient of ingredients.rows) {
    const list = byCustomFoodId.get(ingredient.custom_food_id) ?? [];
    list.push(ingredient);
    byCustomFoodId.set(ingredient.custom_food_id, list);
  }

  for (const [customFoodId, recipeIngredients] of byCustomFoodId) {
    let totalGrams = 0;
    let kcal = 0;
    let proteinG = 0;
    let fatG = 0;
    let carbG = 0;
    let hasKnownIngredient = false;
    let hasUnknownIngredient = false;

    for (const ingredient of recipeIngredients) {
      const grams = Number(ingredient.quantity_g);
      totalGrams += grams;
      const summary = ingredient.food_source === "indb" ? summaryByCode.get(ingredient.food_ref) : undefined;
      if (!summary) {
        hasUnknownIngredient = true;
        continue;
      }
      hasKnownIngredient = true;
      const scale = grams / 100;
      kcal += (summary.kcalPer100g ?? 0) * scale;
      proteinG += (summary.proteinGPer100g ?? 0) * scale;
      fatG += (summary.fatGPer100g ?? 0) * scale;
      carbG += (summary.carbGPer100g ?? 0) * scale;
    }

    if (hasKnownIngredient && totalGrams > 0) {
      byId.set(customFoodId, {
        perGram: { kcal: kcal / totalGrams, proteinG: proteinG / totalGrams, fatG: fatG / totalGrams, carbG: carbG / totalGrams },
        confidence: hasUnknownIngredient ? "estimated" : "calculated",
      });
    }
  }

  return byId;
}

interface NutritionLookups {
  summaryByCode: Map<string, FoodNutrientSummary>;
  overlayByCode: Map<string, FoodNutritionOverlayRow>;
  customFoodMacrosById: Map<string, CustomFoodMacros>;
  customFoodNameById: Map<string, string>;
  packagedById: Awaited<ReturnType<PackagedFoodService["getNutrientSummaries"]>>;
}

/** Pure per-row resolver, extracted so both the live (historical-fallback) path in
 * `enrichWithMacros` and `computeNutritionSnapshot` (used at write time) share one implementation -
 * no duplicated branching between "what we show" and "what we save". */
function resolveFreshNutrition(
  row: Pick<FoodLogRow, "food_source" | "food_ref" | "quantity" | "unit">,
  lookups: NutritionLookups,
): ResolvedNutrition {
  if (row.food_source === "indb") {
    const baseSummary = lookups.summaryByCode.get(row.food_ref);
    if (!baseSummary) {
      return { macros: null, food_name: null, confidence: null, version: null };
    }
    const resolved = applyFoodNutritionOverlay(baseSummary, lookups.overlayByCode.get(row.food_ref));
    const grams = resolveGrams(Number(row.quantity), row.unit, baseSummary.servingGramsByName);
    const macros = computeMacros(grams, resolved);
    return {
      macros,
      food_name: baseSummary.name,
      confidence: macros ? resolved.confidence : null,
      version: macros ? resolved.version : null,
    };
  }

  if (row.food_source === "custom") {
    const customMacros = lookups.customFoodMacrosById.get(row.food_ref);
    const food_name = lookups.customFoodNameById.get(row.food_ref) ?? null;
    if (!customMacros) {
      return { macros: null, food_name, confidence: null, version: null };
    }
    const gramsLogged = Number(row.quantity); // custom foods: quantity is always grams of the recipe
    const scaled = (perGramValue: number | null) =>
      perGramValue === null ? null : Math.round(perGramValue * gramsLogged * 10) / 10;
    return {
      macros: {
        kcal: scaled(customMacros.perGram.kcal),
        proteinG: scaled(customMacros.perGram.proteinG),
        fatG: scaled(customMacros.perGram.fatG),
        carbG: scaled(customMacros.perGram.carbG),
      },
      food_name,
      confidence: customMacros.confidence,
      // No app.food_nutrition overlay support for custom-food ingredients yet (see
      // getFoodNutritionOverlay's docstring) - always the baseline version.
      version: 0,
    };
  }

  if (row.food_source === "packaged") {
    const basePackaged = lookups.packagedById.get(row.food_ref);
    if (!basePackaged) {
      return { macros: null, food_name: null, confidence: null, version: null };
    }
    const resolved = applyFoodNutritionOverlay(
      {
        kcalPer100g: basePackaged.kcal,
        proteinGPer100g: basePackaged.proteinG,
        fatGPer100g: basePackaged.fatG,
        carbGPer100g: basePackaged.carbG,
      },
      lookups.overlayByCode.get(row.food_ref),
    );
    // A real correction overrides the base OFF-sourced confidence (e.g. a verified manufacturer
    // label replacing a crowdsourced value) - but absent one, applyFoodNutritionOverlay's own
    // 'verified' default would be wrong here (OFF data defaults 'unverified', not 'verified' -
    // see finding #11), so that default is overridden back when no overlay exists.
    const confidence = lookups.overlayByCode.has(row.food_ref) ? resolved.confidence : basePackaged.confidence;
    const gramsLogged = Number(row.quantity); // packaged foods: quantity is always grams, same v1 simplification as custom foods
    const scale = gramsLogged / 100;
    const scaled = (per100g: number | null) => (per100g === null ? null : Math.round(per100g * scale * 10) / 10);
    return {
      macros: {
        kcal: scaled(resolved.kcalPer100g),
        proteinG: scaled(resolved.proteinGPer100g),
        fatG: scaled(resolved.fatGPer100g),
        carbG: scaled(resolved.carbGPer100g),
      },
      food_name: basePackaged.brand ? `${basePackaged.name} (${basePackaged.brand})` : basePackaged.name,
      confidence,
      version: resolved.version,
    };
  }

  return { macros: null, food_name: null, confidence: null, version: null };
}

async function buildLookups(
  rows: Pick<FoodLogRow, "food_source" | "food_ref">[],
  food: FoodService,
  db: DatabaseService,
  packagedFood: PackagedFoodService,
): Promise<NutritionLookups> {
  const indbCodes = [...new Set(rows.filter((row) => row.food_source === "indb").map((row) => row.food_ref))];
  const customFoodIds = [...new Set(rows.filter((row) => row.food_source === "custom").map((row) => row.food_ref))];
  const packagedFoodIds = [
    ...new Set(rows.filter((row) => row.food_source === "packaged").map((row) => row.food_ref)),
  ];

  const summaryByCode = await food.getNutrientSummaries(indbCodes);
  const customFoodMacrosById = await computeCustomFoodMacros(customFoodIds, food, db);
  const packagedById = await packagedFood.getNutrientSummaries(packagedFoodIds);
  const customFoodNameById = await getCustomFoodNames(customFoodIds, db);
  // Checked last (not because order matters for correctness, but so existing call-position-based
  // tests of the other lookups above are untouched by this addition) - see this function's own
  // docstring for why it's near-always an empty lookup today.
  const overlayByCode = await getFoodNutritionOverlay([...indbCodes, ...packagedFoodIds], db);

  return { summaryByCode, overlayByCode, customFoodMacrosById, customFoodNameById, packagedById };
}

/** Enriches raw food_log rows with real macros for indb-sourced rows (ARCHITECTURE.md §2),
 * custom-food rows (sum of each recipe's indb-sourced ingredients, scaled by grams logged), and
 * packaged-food rows (Open Food Facts, PRD §5.5). Pulled out of `listByDate` so the sync pull path
 * (which also returns food_log rows) can reuse it.
 *
 * **Historical-integrity rule (docs/FOOD_DATABASE_AUDIT.md finding #10)**: when a row already has
 * a stored snapshot (`kcal_snapshot` non-null - written at log time by `FoodLogService.create`/
 * `update` or by `SyncService.push`'s food_log handling, or backfilled once by
 * `db/backfill-food-log-snapshot.ts`), that snapshot is returned as-is - NEVER re-derived from the
 * current state of public.food_nutrient/app.custom_food_ingredient/app.packaged_food. This is what
 * lets a future app.food_nutrition correction change what a *new* log shows without silently
 * rewriting what an already-logged meal displayed at the time. A row with no snapshot yet (not
 * backfilled, or from before this migration) falls back to the live computation below - the exact
 * behaviour this function always had. */
export async function enrichWithMacros(
  rows: FoodLogRow[],
  food: FoodService,
  db: DatabaseService,
  packagedFood: PackagedFoodService,
): Promise<FoodLogEntryWithMacros[]> {
  const lookups = await buildLookups(rows, food, db, packagedFood);

  return rows.map((row) => {
    if (row.kcal_snapshot != null) {
      return {
        ...row,
        macros: {
          kcal: Number(row.kcal_snapshot),
          proteinG: row.protein_g_snapshot == null ? null : Number(row.protein_g_snapshot),
          fatG: row.fat_g_snapshot == null ? null : Number(row.fat_g_snapshot),
          carbG: row.carb_g_snapshot == null ? null : Number(row.carb_g_snapshot),
        },
        // food_name is still resolved fresh below for a snapshot row too - it's a display label,
        // not a nutrition value, and re-resolving it costs nothing extra since buildLookups()
        // already fetched everything needed.
        food_name: resolveFreshNutrition(row, lookups).food_name,
      };
    }

    const resolved = resolveFreshNutrition(row, lookups);
    return { ...row, macros: resolved.macros, food_name: resolved.food_name };
  });
}

/** What `FoodLogService.create`/`update` and `SyncService.push`'s food_log handling store into
 * app.food_log's snapshot columns for one row, computed via the exact same `resolveFreshNutrition`
 * the live/historical-fallback path uses - see `enrichWithMacros`'s docstring for why a snapshot,
 * once written, is never recomputed again for that row. */
export async function computeNutritionSnapshot(
  row: Pick<FoodLogRow, "food_source" | "food_ref" | "quantity" | "unit">,
  food: FoodService,
  db: DatabaseService,
  packagedFood: PackagedFoodService,
): Promise<ResolvedNutrition> {
  const lookups = await buildLookups([row], food, db, packagedFood);
  return resolveFreshNutrition(row, lookups);
}

/** Batched name lookup for custom_food rows, mirroring the batch-everything-up-front style
 * computeCustomFoodMacros already uses - one query for however many distinct custom foods
 * appear in this call's rows, not one per row. */
async function getCustomFoodNames(customFoodIds: string[], db: DatabaseService): Promise<Map<string, string>> {
  if (customFoodIds.length === 0) {
    return new Map();
  }
  const result = await db.query<{ id: string; name: string }>(
    "SELECT id, name FROM app.custom_food WHERE id = ANY($1)",
    [customFoodIds],
  );
  return new Map(result.rows.map((row) => [row.id, row.name]));
}

@Injectable()
export class FoodLogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly food: FoodService,
    private readonly packagedFood: PackagedFoodService,
  ) {}

  async create(accountId: string, input: CreateFoodLogRequest): Promise<FoodLogRow> {
    const snapshot = await computeNutritionSnapshot(
      { food_source: input.foodSource, food_ref: input.foodRef, quantity: String(input.quantity), unit: input.unit },
      this.food,
      this.db,
      this.packagedFood,
    );
    const result = await this.db.query<FoodLogRow>(
      `INSERT INTO app.food_log
         (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source, is_estimate,
          kcal_snapshot, protein_g_snapshot, fat_g_snapshot, carb_g_snapshot, nutrition_confidence, nutrition_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        input.id,
        accountId,
        input.foodSource,
        input.foodRef,
        input.quantity,
        input.unit,
        input.mealType,
        input.loggedAt,
        input.source,
        input.isEstimate ?? false,
        snapshot.macros?.kcal ?? null,
        snapshot.macros?.proteinG ?? null,
        snapshot.macros?.fatG ?? null,
        snapshot.macros?.carbG ?? null,
        snapshot.confidence,
        snapshot.version ?? 0,
      ],
    );
    return result.rows[0];
  }

  /** One UTC day's entries, enriched with real macros for indb-sourced rows (ARCHITECTURE.md §2). */
  async listByDate(accountId: string, date: string): Promise<FoodLogEntryWithMacros[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const result = await this.db.query<FoodLogRow>(
      `SELECT * FROM app.food_log
       WHERE account_id = $1 AND logged_at >= $2 AND logged_at < $3 AND is_deleted = false
       ORDER BY logged_at`,
      [accountId, start, end],
    );

    return enrichWithMacros(result.rows, this.food, this.db, this.packagedFood);
  }

  async update(accountId: string, id: string, patch: UpdateFoodLogRequest): Promise<FoodLogRow> {
    const existing = await this.findOwned(accountId, id);
    const quantity = patch.quantity ?? existing.quantity;
    const unit = patch.unit ?? existing.unit;
    // A user editing their own entry's quantity/unit is an ordinary edit, not a data correction -
    // the snapshot must be recomputed so it reflects what they just changed it to, exactly as
    // `create` would compute it for a brand-new row with these values.
    const snapshot = await computeNutritionSnapshot(
      { food_source: existing.food_source, food_ref: existing.food_ref, quantity: String(quantity), unit },
      this.food,
      this.db,
      this.packagedFood,
    );
    const result = await this.db.query<FoodLogRow>(
      `UPDATE app.food_log SET
         quantity = $3, unit = $4, meal_type = $5, logged_at = $6, updated_at = now(), server_updated_at = now(),
         kcal_snapshot = $7, protein_g_snapshot = $8, fat_g_snapshot = $9, carb_g_snapshot = $10,
         nutrition_confidence = $11, nutrition_version = $12
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      [
        id,
        accountId,
        quantity,
        unit,
        patch.mealType ?? existing.meal_type,
        patch.loggedAt ?? existing.logged_at,
        snapshot.macros?.kcal ?? null,
        snapshot.macros?.proteinG ?? null,
        snapshot.macros?.fatG ?? null,
        snapshot.macros?.carbG ?? null,
        snapshot.confidence,
        snapshot.version ?? 0,
      ],
    );
    return result.rows[0];
  }

  async softDelete(accountId: string, id: string): Promise<void> {
    await this.findOwned(accountId, id);
    await this.db.query(
      "UPDATE app.food_log SET is_deleted = true, updated_at = now(), server_updated_at = now() WHERE id = $1 AND account_id = $2",
      [id, accountId],
    );
  }

  private async findOwned(accountId: string, id: string): Promise<FoodLogRow> {
    const result = await this.db.query<FoodLogRow>(
      "SELECT * FROM app.food_log WHERE id = $1 AND is_deleted = false",
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`No food_log entry with id '${id}'`);
    }
    if (row.account_id !== accountId) {
      throw new ForbiddenException("Not your food_log entry");
    }
    return row;
  }
}
