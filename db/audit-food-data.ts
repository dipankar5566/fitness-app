/**
 * Read-only audit of the food nutrition database (docs/FOOD_DATABASE_AUDIT.md's data source).
 * Opens a single `BEGIN READ ONLY` transaction so any accidental write anywhere in this script
 * fails loudly instead of touching production data - see CLAUDE.md's architecture rule that
 * public.* (indb) stays read-only from app code, which this audit treats as a hard constraint on
 * itself too. Writes CSVs + a summary JSON to db/audit-output/ (gitignored); never writes to the
 * database.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm audit:food
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyFoodCategory,
  energyConsistency,
  servingPlausibility,
  validateNutrientProfile,
  type FoodCategory,
  type ValidationFlag,
} from "@fitness-app/shared";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "audit-output");

interface FlagRow {
  foodCode: string;
  foodType: string;
  category: FoodCategory | "";
  rule: string;
  severity: string;
  message: string;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv<T extends object>(filename: string, rows: T[], columns: (keyof T)[]) {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => csvEscape(row[c] as string | number)).join(",")),
  ];
  writeFileSync(join(outDir, filename), lines.join("\n") + "\n", "utf8");
  console.log(`wrote ${filename}: ${rows.length} rows`);
}

interface FoodRow {
  id: number;
  code: string;
  name: string;
  food_type: string;
}
interface FoodNameRow {
  food_id: number;
  name: string;
}
interface NutrientValueRow {
  food_id: number;
  nutrient_code: string;
  per_100g: string | null;
}
interface RecipeIngredientRow {
  recipe_food_id: number;
  ingredient_name: string;
  ingredient_food_id: number | null;
  quantity: string | null;
  unit: string | null;
}
interface ServingMeasureRow {
  food_id: number;
  name: string;
  grams: string | null;
}
interface ExternalRefRow {
  food_id: number;
  match: string | null;
  external_id: string;
}

const CORE_NUTRIENTS = ["energy_kcal", "protein_g", "fat_g", "carb_g", "fibre_g"] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Enforced read-only: any stray write in this script (or a future edit to it) fails loudly
    // instead of silently touching production data.
    await client.query("BEGIN READ ONLY");

    const foods = (await client.query<FoodRow>("SELECT id, code, name, food_type FROM food")).rows;
    const foodById = new Map(foods.map((f) => [f.id, f]));

    const namesByFoodId = new Map<number, string[]>();
    for (const row of (await client.query<FoodNameRow>("SELECT food_id, name FROM food_name")).rows) {
      const list = namesByFoodId.get(row.food_id) ?? [];
      list.push(row.name);
      namesByFoodId.set(row.food_id, list);
    }

    const ingredientsByRecipeId = new Map<number, RecipeIngredientRow[]>();
    const allIngredientRows = (
      await client.query<RecipeIngredientRow>(
        "SELECT recipe_food_id, ingredient_name, ingredient_food_id, quantity, unit FROM recipe_ingredient",
      )
    ).rows;
    for (const row of allIngredientRows) {
      const list = ingredientsByRecipeId.get(row.recipe_food_id) ?? [];
      list.push(row);
      ingredientsByRecipeId.set(row.recipe_food_id, list);
    }

    const nutrientRows = (
      await client.query<NutrientValueRow>(
        `SELECT fn.food_id, n.code AS nutrient_code, fn.per_100g
         FROM food_nutrient fn JOIN nutrient n ON n.id = fn.nutrient_id`,
      )
    ).rows;
    const nutrientsByFoodId = new Map<number, Map<string, number | null>>();
    for (const row of nutrientRows) {
      const map = nutrientsByFoodId.get(row.food_id) ?? new Map();
      map.set(row.nutrient_code, row.per_100g === null ? null : Number(row.per_100g));
      nutrientsByFoodId.set(row.food_id, map);
    }

    const servingRows = (
      await client.query<ServingMeasureRow>("SELECT food_id, name, grams FROM serving_measure")
    ).rows;
    const servingsByFoodId = new Map<number, ServingMeasureRow[]>();
    for (const row of servingRows) {
      const list = servingsByFoodId.get(row.food_id) ?? [];
      list.push(row);
      servingsByFoodId.set(row.food_id, list);
    }

    const externalRefRows = (
      await client.query<ExternalRefRow>("SELECT food_id, match, external_id FROM food_external_ref")
    ).rows;

    // ---- 1. Category + food_type counts ----------------------------------------------------
    const categoryCounts = new Map<string, number>();
    const categoryByFoodId = new Map<number, FoodCategory>();
    for (const food of foods) {
      const isRecipe = food.food_type === "recipe";
      const ingredientTexts = (ingredientsByRecipeId.get(food.id) ?? []).flatMap((ri) => {
        const texts = [ri.ingredient_name];
        if (ri.ingredient_food_id !== null) {
          const linked = foodById.get(ri.ingredient_food_id);
          if (linked) texts.push(linked.name);
        }
        return texts;
      });
      const category = classifyFoodCategory({
        isRecipe,
        names: [food.name, ...(namesByFoodId.get(food.id) ?? [])],
        ingredientTexts,
      });
      categoryByFoodId.set(food.id, category);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      categoryCounts.set(
        `${food.food_type}_total`,
        (categoryCounts.get(`${food.food_type}_total`) ?? 0) + 1,
      );
    }
    writeCsv(
      "category_counts.csv",
      [...categoryCounts.entries()].map(([category, count]) => ({ category, count })),
      ["category", "count"],
    );

    // ---- 2+3. Per-food nutrient validation + energy consistency + missing core nutrients ----
    const flags: FlagRow[] = [];
    let missingCoreNutrientCount = 0;
    for (const food of foods) {
      const nutrientMap = nutrientsByFoodId.get(food.id) ?? new Map();
      const profile = {
        kcalPer100g: nutrientMap.get("energy_kcal") ?? null,
        proteinGPer100g: nutrientMap.get("protein_g") ?? null,
        fatGPer100g: nutrientMap.get("fat_g") ?? null,
        carbGPer100g: nutrientMap.get("carb_g") ?? null,
        fibreGPer100g: nutrientMap.get("fibre_g") ?? null,
      };
      const category = categoryByFoodId.get(food.id) ?? "";

      for (const nutrientCode of CORE_NUTRIENTS) {
        if (!nutrientMap.has(nutrientCode) || nutrientMap.get(nutrientCode) === null) {
          missingCoreNutrientCount += 1;
          flags.push({
            foodCode: food.code,
            foodType: food.food_type,
            category,
            rule: "missing_core_nutrient",
            severity: "warning",
            message: `${nutrientCode} is missing (null, not zero)`,
          });
        }
      }

      const validationFlags: ValidationFlag[] = [
        ...validateNutrientProfile(profile),
        ...energyConsistency(profile, { tolerance: 0.15 }),
      ];
      for (const flag of validationFlags) {
        flags.push({
          foodCode: food.code,
          foodType: food.food_type,
          category,
          rule: flag.rule,
          severity: flag.severity,
          message: flag.message,
        });
      }

      // Serving plausibility.
      for (const serving of servingsByFoodId.get(food.id) ?? []) {
        if (serving.grams === null) continue;
        for (const flag of servingPlausibility(serving.name, Number(serving.grams))) {
          flags.push({
            foodCode: food.code,
            foodType: food.food_type,
            category,
            rule: flag.rule,
            severity: flag.severity,
            message: flag.message,
          });
        }
      }

      // Recipe method flags: a frying-medium line, and a water/stock line that dominates weight.
      if (food.food_type === "recipe") {
        const ingredients = ingredientsByRecipeId.get(food.id) ?? [];
        // "Fat"/"Shortening" are INDB's own generic placeholder names for a frying medium
        // (confirmed via food_external_ref: their linked ingredient rows resolve to real butter/
        // ghee/oil foods) - a name-only match on "oil|ghee" alone misses ~55 recipes that use
        // this generic name instead. And the pan-quantity pattern isn't only written in cup
        // units - BFP420's "Oil" is 240ml (confirmed directly), so a large ml/g quantity (>=100,
        // i.e. at least ~0.4 cup) is flagged the same as an explicit cup/C unit.
        const fryLines = ingredients.filter((ri) => {
          if (!/\b(oil|ghee|fat|shortening)\b/i.test(ri.ingredient_name)) return false;
          const unit = (ri.unit ?? "").toLowerCase();
          if (unit === "c" || unit === "cup" || unit === "cups") return true;
          if ((unit === "ml" || unit === "g") && ri.quantity !== null && Number(ri.quantity) >= 100) return true;
          return false;
        });
        for (const line of fryLines) {
          flags.push({
            foodCode: food.code,
            foodType: food.food_type,
            category,
            rule: "frying_oil_pan_quantity",
            severity: "critical",
            message: `"${line.ingredient_name}" recorded as ${line.quantity} ${line.unit} - looks like the literal pan quantity, not an absorbed-oil estimate`,
          });
        }

        const gramsOf = (ri: RecipeIngredientRow): number | null => {
          if (ri.quantity === null || ri.unit === null) return null;
          const qty = Number(ri.quantity);
          const unit = ri.unit.toLowerCase();
          if (unit === "g" || unit === "ml") return qty;
          if (unit === "c" || unit === "cup" || unit === "cups") return qty * 240;
          if (unit === "tbsp") return qty * 15;
          if (unit === "tsp") return qty * 5;
          return null;
        };
        let totalGrams = 0;
        let waterGrams = 0;
        let hasUnknownUnit = false;
        for (const ri of ingredients) {
          const grams = gramsOf(ri);
          if (grams === null) {
            hasUnknownUnit = true;
            continue;
          }
          totalGrams += grams;
          if (/water|stock/i.test(ri.ingredient_name)) {
            waterGrams += grams;
          }
        }
        if (!hasUnknownUnit && totalGrams > 0 && waterGrams / totalGrams > 0.3) {
          flags.push({
            foodCode: food.code,
            foodType: food.food_type,
            category,
            rule: "cooking_water_weight_share",
            severity: "critical",
            message: `water/stock is ${((waterGrams / totalGrams) * 100).toFixed(0)}% of recorded ingredient weight - likely counted as eaten weight instead of a discarded cooking medium`,
          });
        }
      }
    }
    writeCsv("flags.csv", flags, ["foodCode", "foodType", "category", "rule", "severity", "message"]);

    // ---- 4. Duplicates: trigram-similar names within the same food_type --------------------
    const dupResult = await client.query<{
      code_a: string;
      code_b: string;
      name_a: string;
      name_b: string;
      similarity: number;
    }>(
      `SELECT f1.code AS code_a, f2.code AS code_b, f1.name AS name_a, f2.name AS name_b,
              similarity(f1.name, f2.name) AS similarity
       FROM food f1 JOIN food f2 ON f1.id < f2.id AND f1.food_type = f2.food_type
       WHERE similarity(f1.name, f2.name) >= 0.8
       ORDER BY similarity DESC`,
    );
    writeCsv(
      "duplicates.csv",
      dupResult.rows.map((r) => ({ ...r, similarity: Number(r.similarity).toFixed(2) })),
      ["code_a", "code_b", "name_a", "name_b", "similarity"],
    );

    // ---- 5. USDA mapping quality (close/proxy matches worth a second look) -----------------
    const mappingRows = externalRefRows
      .filter((r) => r.match === "close" || r.match === "proxy")
      .map((r) => {
        const food = foodById.get(r.food_id);
        return {
          food_code: food?.code ?? "",
          name: food?.name ?? "",
          match: r.match ?? "",
          external_id: r.external_id,
        };
      });
    writeCsv("usda_mapping_quality.csv", mappingRows, ["food_code", "name", "match", "external_id"]);

    // ---- 6. Aliases pointing at a stateless (no raw/cooked marker) ingredient --------------
    const aliasResult = await client.query<{ alias: string; food_code: string; ingredient_name: string }>(
      `SELECT a.alias, a.food_code, f.name AS ingredient_name
       FROM app.food_alias a JOIN food f ON f.code = a.food_code
       WHERE f.food_type = 'ingredient'`,
    );
    writeCsv("stateless_ingredient_aliases.csv", aliasResult.rows, ["alias", "food_code", "ingredient_name"]);

    // ---- 7. app-side rows referencing a food with no kcal value ----------------------------
    const foodLogNullKcal = await client.query<{ row_id: string; food_ref: string }>(
      `SELECT fl.id AS row_id, fl.food_ref
       FROM app.food_log fl
       WHERE fl.food_source = 'indb' AND fl.is_deleted = false
         AND NOT EXISTS (
           SELECT 1 FROM food f JOIN food_nutrient fn ON fn.food_id = f.id
           JOIN nutrient n ON n.id = fn.nutrient_id
           WHERE f.code = fl.food_ref AND n.code = 'energy_kcal' AND fn.per_100g IS NOT NULL
         )`,
    );
    const customIngredientNullKcal = await client.query<{ row_id: string; food_ref: string }>(
      `SELECT cfi.custom_food_id AS row_id, cfi.food_ref
       FROM app.custom_food_ingredient cfi
       WHERE cfi.food_source = 'indb' AND cfi.is_deleted = false
         AND NOT EXISTS (
           SELECT 1 FROM food f JOIN food_nutrient fn ON fn.food_id = f.id
           JOIN nutrient n ON n.id = fn.nutrient_id
           WHERE f.code = cfi.food_ref AND n.code = 'energy_kcal' AND fn.per_100g IS NOT NULL
         )`,
    );
    writeCsv(
      "app_side_null_kcal_refs.csv",
      [
        ...foodLogNullKcal.rows.map((r) => ({ table: "app.food_log", ...r })),
        ...customIngredientNullKcal.rows.map((r) => ({ table: "app.custom_food_ingredient", ...r })),
      ],
      ["table", "row_id", "food_ref"],
    );

    // ---- Summary JSON ------------------------------------------------------------------------
    const summary = {
      generatedAt: new Date().toISOString(),
      totalFoods: foods.length,
      recipeCount: foods.filter((f) => f.food_type === "recipe").length,
      ingredientCount: foods.filter((f) => f.food_type === "ingredient").length,
      missingCoreNutrientValues: missingCoreNutrientCount,
      flagCountBySeverity: {
        critical: flags.filter((f) => f.severity === "critical").length,
        warning: flags.filter((f) => f.severity === "warning").length,
        info: flags.filter((f) => f.severity === "info").length,
      },
      flagCountByRule: Object.fromEntries(
        [...new Set(flags.map((f) => f.rule))].map((rule) => [rule, flags.filter((f) => f.rule === rule).length]),
      ),
      duplicatePairs: dupResult.rows.length,
      usdaCloseOrProxyMatches: mappingRows.length,
      aliasesPointingAtIngredients: aliasResult.rows.length,
      appSideNullKcalReferences: foodLogNullKcal.rows.length + customIngredientNullKcal.rows.length,
    };
    writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
    console.log("wrote summary.json");
    console.log(JSON.stringify(summary, null, 2));

    await client.query("ROLLBACK"); // read-only transaction; nothing to commit
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
