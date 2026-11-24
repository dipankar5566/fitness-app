/**
 * Dry-run recipe recalculation (Phase 4 of docs/FOOD_DATABASE_AUDIT.md's audit). Read-only: opens
 * a `BEGIN READ ONLY` transaction, writes nothing to the database, and writes only
 * db/audit-output/proposed_corrections.csv for human review. Uses the pure
 * packages/shared/src/recipe-calc.ts engine - this file's only job is turning real
 * recipe_ingredient rows into that engine's input shape and writing the result out.
 *
 * Deliberately does NOT invent a fat-absorption factor for deep-fried recipes: no such factor has
 * been verified against a citable, licensed source yet (see docs/NUTRITION_DATA_SOURCES.md's open
 * item). Every frying_oil_pan_quantity recipe is therefore reported as "unresolved", per the audit
 * brief's rule 15 ("never claim a value is verified without an identifiable source").
 *
 * The cooking_water_weight_share recipes ARE recalculated here, because that correction needs no
 * external factor - excluding a discarded cooking medium's weight from the final dish follows
 * directly from the brief's own definition of "edible portion" (section 4/5), not from a borrowed
 * number. Every one of these is still capped at the "estimated" tier (never "calculated") because
 * telling "water that's drained off" apart from "water a dish absorbs" (rice, dal, dough) needs a
 * human reviewer per recipe, not a blanket rule - see docs/FOOD_DATABASE_CORRECTIONS.md.
 *
 * Usage: DATABASE_URL=postgresql://user:pass@host:port/db pnpm recalc:recipes -- --dry-run
 * (the --dry-run flag is accepted but currently the only mode this script has - it never writes
 * to the database regardless, so the flag exists to make that explicit at the call site and to
 * reserve the name for when Phase 6 adds a real write mode.)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateRecipeNutrition, classifyFoodCategory, type RecipeIngredientLine } from "@fitness-app/shared";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "audit-output");

interface FoodRow {
  id: number;
  code: string;
  name: string;
}
interface RecipeIngredientRow {
  recipe_food_id: number;
  ingredient_name: string;
  ingredient_food_id: number | null;
  quantity: string | null;
  unit: string | null;
}
interface NutrientRow {
  food_id: number;
  nutrient_code: string;
  per_100g: string | null;
}

/** Grams-per-unit conversions sourced directly from INDB's own indb/data/raw/Units.xlsx (read in
 * this session - "1C"/"1cup" = 240ml≈240g water-equivalent, "1tbsp" = 15g (USDA butter/oil
 * reference row), "1tsp" = 5g). A unit not listed here makes its line (and therefore the whole
 * recipe) unresolved rather than guessed. */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  ml: 1,
  c: 240,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tsp: 5,
};

function gramsOf(row: RecipeIngredientRow): number | null {
  if (row.quantity === null || row.unit === null) return null;
  const perUnit = GRAMS_PER_UNIT[row.unit.toLowerCase()];
  if (perUnit === undefined) return null;
  return Number(row.quantity) * perUnit;
}

interface CorrectionRow {
  code: string;
  name: string;
  findingIds: string;
  currentKcal: string;
  proposedKcal: string;
  proposedProteinG: string;
  proposedFatG: string;
  proposedCarbG: string;
  method: string;
  confidenceTier: string;
  needsReview: string;
  notes: string;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function writeCsv(filename: string, rows: CorrectionRow[]) {
  const columns: (keyof CorrectionRow)[] = [
    "code", "name", "findingIds", "currentKcal", "proposedKcal", "proposedProteinG",
    "proposedFatG", "proposedCarbG", "method", "confidenceTier", "needsReview", "notes",
  ];
  const lines = [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))];
  writeFileSync(join(outDir, filename), lines.join("\n") + "\n", "utf8");
  console.log(`wrote ${filename}: ${rows.length} rows`);
}

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
    await client.query("BEGIN READ ONLY");

    const recipes = (
      await client.query<FoodRow>("SELECT id, code, name FROM food WHERE food_type = 'recipe'")
    ).rows;

    const allIngredientRows = (
      await client.query<RecipeIngredientRow>(
        "SELECT recipe_food_id, ingredient_name, ingredient_food_id, quantity, unit FROM recipe_ingredient",
      )
    ).rows;
    const ingredientsByRecipeId = new Map<number, RecipeIngredientRow[]>();
    for (const row of allIngredientRows) {
      const list = ingredientsByRecipeId.get(row.recipe_food_id) ?? [];
      list.push(row);
      ingredientsByRecipeId.set(row.recipe_food_id, list);
    }

    const nutrientRows = (
      await client.query<NutrientRow>(
        `SELECT fn.food_id, n.code AS nutrient_code, fn.per_100g
         FROM food_nutrient fn JOIN nutrient n ON n.id = fn.nutrient_id
         WHERE n.code IN ('energy_kcal', 'protein_g', 'fat_g', 'carb_g', 'fibre_g')`,
      )
    ).rows;
    const nutrientsByFoodId = new Map<number, Map<string, number>>();
    for (const row of nutrientRows) {
      if (row.per_100g === null) continue;
      const map = nutrientsByFoodId.get(row.food_id) ?? new Map();
      map.set(row.nutrient_code, Number(row.per_100g));
      nutrientsByFoodId.set(row.food_id, map);
    }
    function nutrientsForIngredient(foodId: number | null): RecipeIngredientLine["nutrientsPer100g"] {
      if (foodId === null) return null;
      const map = nutrientsByFoodId.get(foodId);
      if (!map || !map.has("energy_kcal")) return null;
      return {
        kcalPer100g: map.get("energy_kcal") ?? 0,
        proteinGPer100g: map.get("protein_g") ?? 0,
        fatGPer100g: map.get("fat_g") ?? 0,
        carbGPer100g: map.get("carb_g") ?? 0,
        fibreGPer100g: map.get("fibre_g") ?? 0,
      };
    }

    const currentKcalByRecipeId = new Map<number, number | null>();
    for (const [foodId, map] of nutrientsByFoodId) {
      currentKcalByRecipeId.set(foodId, map.get("energy_kcal") ?? null);
    }

    const rows: CorrectionRow[] = [];

    for (const recipe of recipes) {
      const ingredients = ingredientsByRecipeId.get(recipe.id) ?? [];
      if (ingredients.length === 0) continue;

      // See audit-food-data.ts's matching comment: "Fat"/"Shortening" are INDB's own generic
      // placeholder names for a frying medium, and the pan-quantity pattern also shows up as a
      // large ml/g amount (e.g. BFP420's "Oil" at 240ml), not only as an explicit cup/C unit.
      const fryLines = ingredients.filter((ri) => {
        if (!/\b(oil|ghee|fat|shortening)\b/i.test(ri.ingredient_name)) return false;
        const unit = (ri.unit ?? "").toLowerCase();
        if (unit === "c" || unit === "cup" || unit === "cups") return true;
        if ((unit === "ml" || unit === "g") && ri.quantity !== null && Number(ri.quantity) >= 100) return true;
        return false;
      });
      const waterLines = ingredients.filter((ri) => /water|stock/i.test(ri.ingredient_name));
      if (fryLines.length === 0 && waterLines.length === 0) continue; // not a flagged recipe

      const currentKcal = currentKcalByRecipeId.get(recipe.id) ?? null;

      if (fryLines.length > 0) {
        // No cited fat-absorption factor exists yet (docs/NUTRITION_DATA_SOURCES.md) - report
        // unresolved rather than guess a number for a production food database.
        rows.push({
          code: recipe.code,
          name: recipe.name,
          findingIds: "frying_oil_pan_quantity",
          currentKcal: currentKcal === null ? "" : String(currentKcal),
          proposedKcal: "",
          proposedProteinG: "",
          proposedFatG: "",
          proposedCarbG: "",
          method: "unresolved",
          confidenceTier: "unresolved",
          needsReview: "true",
          notes: `oil/ghee line(s) recorded as a pan quantity (${fryLines.map((f) => `${f.quantity}${f.unit}`).join(", ")}); needs a cited fat-absorption factor before recalculation`,
        });
        continue;
      }

      // Beverages and soups/stews are liquid-based dishes where the water IS the food, not a
      // discarded cooking medium - the naive "exclude every water/stock line" rule that correctly
      // fixes a boiled egg or chapati would wrongly shrink a cup of tea or a bowl of soup down to
      // almost nothing. Confirmed directly against this dry run's own output ("Hot tea" came back
      // as 102.6 kcal/100g, more concentrated than brewed tea has any right to be) - so these
      // categories are left unresolved for a human reviewer instead of auto-corrected.
      const category = classifyFoodCategory({
        isRecipe: true,
        names: [recipe.name],
        ingredientTexts: ingredients.map((ri) => ri.ingredient_name),
      });
      if (category === "snack_beverage" || category === "international_recipe") {
        rows.push({
          code: recipe.code,
          name: recipe.name,
          findingIds: "cooking_water_weight_share",
          currentKcal: currentKcal === null ? "" : String(currentKcal),
          proposedKcal: "",
          proposedProteinG: "",
          proposedFatG: "",
          proposedCarbG: "",
          method: "unresolved",
          confidenceTier: "unresolved",
          needsReview: "true",
          notes: `category "${category}" (beverage/soup) - its water/stock may BE the food, not a discarded cooking medium; the blanket exclusion rule must not be applied here without a human reviewer confirming which water lines are actually drained off`,
        });
        continue;
      }

      // Water/stock-share recipe: build engine input, excluding matched water/stock lines.
      const lines: RecipeIngredientLine[] = [];
      let hasUnconvertibleUnit = false;
      for (const ri of ingredients) {
        const grams = gramsOf(ri);
        if (grams === null) {
          hasUnconvertibleUnit = true;
          continue;
        }
        const isWater = /water|stock/i.test(ri.ingredient_name);
        lines.push({
          name: ri.ingredient_name,
          role: isWater ? "excluded_cooking_medium" : "contributing",
          grams,
          nutrientsPer100g: isWater ? null : nutrientsForIngredient(ri.ingredient_food_id),
        });
      }

      if (hasUnconvertibleUnit) {
        rows.push({
          code: recipe.code,
          name: recipe.name,
          findingIds: "cooking_water_weight_share",
          currentKcal: currentKcal === null ? "" : String(currentKcal),
          proposedKcal: "",
          proposedProteinG: "",
          proposedFatG: "",
          proposedCarbG: "",
          method: "unresolved",
          confidenceTier: "unresolved",
          needsReview: "true",
          notes: "at least one ingredient line uses a unit this script can't convert to grams (e.g. 'sprig', 'knob') - needs manual unit resolution before recalculation",
        });
        continue;
      }

      const result = calculateRecipeNutrition({ ingredients: lines });
      rows.push({
        code: recipe.code,
        name: recipe.name,
        findingIds: "cooking_water_weight_share",
        currentKcal: currentKcal === null ? "" : String(currentKcal),
        proposedKcal: result.per100g ? result.per100g.kcalPer100g.toFixed(1) : "",
        proposedProteinG: result.per100g ? result.per100g.proteinGPer100g.toFixed(1) : "",
        proposedFatG: result.per100g ? result.per100g.fatGPer100g.toFixed(1) : "",
        proposedCarbG: result.per100g ? result.per100g.carbGPer100g.toFixed(1) : "",
        method: "excluded cooking-medium water/stock from edible weight; no retention factor applied (undocumented)",
        confidenceTier: result.tier, // never "calculated" here - always estimated or unresolved
        needsReview: "true", // drained-vs-absorbed water classification needs a human per recipe
        notes:
          result.missingNutrientIngredients.length > 0
            ? `missing nutrient data for: ${result.missingNutrientIngredients.join(", ")}`
            : "",
      });
    }

    writeCsv("proposed_corrections.csv", rows);
    console.log(`${rows.length} recipes proposed for correction (dry run - no database write occurred).`);

    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
