/**
 * Pure recipe nutrition calculation engine (audit brief section 7). Used by `db/recalc-recipes.ts`
 * for a dry-run recalculation of INDB recipes flagged by the audit - never by the live app (M2's
 * `apps/api/src/food-log/food-log.service.ts` has its own, separate, already-shipped custom-food
 * calculator with a known `?? 0` bug - see `docs/FOOD_DATABASE_AUDIT.md` finding #8 - fixing that
 * is a Phase 5+ app change, not this module's job).
 *
 * Every number this engine produces is traceable to either an ingredient's own sourced per-100g
 * values or an explicitly-passed, cited factor (`FryingAbsorptionFactor.source`,
 * `RecipeIngredientLine.retentionFactor`'s caller-documented origin). Nothing here invents a
 * value: an ingredient with no known nutrients is never treated as contributing 0 silently - it is
 * excluded from the sums AND named in `missingNutrientIngredients`, which caps the result's
 * confidence tier below "calculated" (brief section 15: "never convert missing values to zero").
 */

export interface RecipeNutrientProfile {
  kcalPer100g: number;
  proteinGPer100g: number;
  fatGPer100g: number;
  carbGPer100g: number;
  fibreGPer100g: number;
}

export type IngredientRole =
  /** Eaten as part of the final dish - its full (role-appropriate) weight and nutrients count. */
  | "contributing"
  /** The oil/ghee/fat a food is deep- or shallow-fried in. Only a documented fraction of its
   * stated pan quantity is assumed absorbed into the final dish - see `FryingAbsorptionFactor`. */
  | "frying_medium"
  /** A cooking medium that is not eaten with the dish (e.g. the water a boiled egg sits in, pasta-
   * boiling water that gets drained) - excluded entirely from both weight and nutrients. An
   * ingredient whose water *is* incorporated (dal, rice, dough) should be role "contributing"
   * with its real nutrient contribution (water itself contributes 0 kcal/macros either way; what
   * matters is that its weight is or isn't part of the final dish). */
  | "excluded_cooking_medium";

export interface RecipeIngredientLine {
  name: string;
  role: IngredientRole;
  /** Already unit-converted to grams by the caller (e.g. via INDB's own Units.xlsx conversions -
   * this module does no unit conversion itself, so it can't silently misinterpret a unit). */
  grams: number;
  /** Per-100g values from the authoritative source for this specific ingredient at its stated
   * prep state. Null means genuinely unknown - never substitute a guess before calling this. */
  nutrientsPer100g: RecipeNutrientProfile | null;
  /** 0..1 fraction of each nutrient retained after cooking, when a specific documented retention
   * factor applies to this ingredient (e.g. USDA Nutrient Retention Factors). Omitted (not 1 by
   * silent default assumption) means "no retention loss was documented for this line" - the
   * caller decides whether that should instead block the "calculated" tier for this recipe. */
  retentionFactor?: number;
}

export interface FryingAbsorptionFactor {
  /** Fraction of the frying_medium ingredients' combined stated grams that ends up absorbed into
   * the final dish, per a cited methodology (e.g. EuroFIR/FAO-INFOODS recipe-calculation
   * guidance) - NOT the full pan quantity, which is what INDB's raw ingredient lines record
   * (confirmed directly: multiple recipes record frying oil as "2 cups", the literal pan
   * quantity - see docs/FOOD_DATABASE_AUDIT.md finding #1). */
  absorptionFraction: number;
  source: string;
}

export interface RecipeCalcInput {
  ingredients: RecipeIngredientLine[];
  /** Required if any ingredient has role "frying_medium"; its absence makes the recipe
   * "unresolved" rather than silently treating the oil as fully eaten or fully discarded. */
  fryingAbsorption?: FryingAbsorptionFactor;
}

export type ConfidenceTier = "calculated" | "estimated" | "unresolved";

export interface RecipeCalcResult {
  tier: ConfidenceTier;
  /** Null only when unresolved (no frying absorption factor for a recipe that needs one). */
  finalWeightG: number | null;
  /** Absolute totals for the whole recipe as calculated (not yet divided by weight). */
  totals: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbG: number;
    fibreG: number;
  };
  /** Null only when finalWeightG is null (unresolved). */
  per100g: RecipeNutrientProfile | null;
  /** Names of "contributing" ingredients whose nutrientsPer100g was null - their physical weight
   * still counts toward finalWeightG, but they contributed nothing to totals, so the true value is
   * understated by at least this much. Non-empty here means the tier can never be "calculated". */
  missingNutrientIngredients: string[];
  /** Why the recipe couldn't be resolved at all (finalWeightG/per100g are null) - empty unless
   * tier === "unresolved". */
  unresolvedReasons: string[];
}

function emptyTotals() {
  return { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fibreG: 0 };
}

function addScaled(
  totals: ReturnType<typeof emptyTotals>,
  nutrients: RecipeNutrientProfile,
  grams: number,
  retentionFactor: number,
): void {
  const scale = (grams / 100) * retentionFactor;
  totals.kcal += nutrients.kcalPer100g * scale;
  totals.proteinG += nutrients.proteinGPer100g * scale;
  totals.fatG += nutrients.fatGPer100g * scale;
  totals.carbG += nutrients.carbGPer100g * scale;
  totals.fibreG += nutrients.fibreGPer100g * scale;
}

/**
 * Calculates a recipe's total nutrition and final weight from its ingredient lines (brief
 * section 7's formula). Pure and deterministic: calling this twice with the same input always
 * returns the same result (no hidden mutable state, no randomness, no wall-clock dependency).
 */
export function calculateRecipeNutrition(input: RecipeCalcInput): RecipeCalcResult {
  const frying = input.ingredients.filter((i) => i.role === "frying_medium");
  if (frying.length > 0 && !input.fryingAbsorption) {
    return {
      tier: "unresolved",
      finalWeightG: null,
      totals: emptyTotals(),
      per100g: null,
      missingNutrientIngredients: [],
      unresolvedReasons: [
        `recipe has a frying_medium ingredient (${frying.map((i) => i.name).join(", ")}) but no documented FryingAbsorptionFactor was supplied`,
      ],
    };
  }

  const totals = emptyTotals();
  const missingNutrientIngredients: string[] = [];
  let hadUndocumentedRetention = false;
  let finalWeightG = 0;

  for (const ingredient of input.ingredients) {
    if (ingredient.role === "excluded_cooking_medium") {
      continue; // Neither weight nor nutrients from this line reach the final dish.
    }

    const grams =
      ingredient.role === "frying_medium"
        ? ingredient.grams * (input.fryingAbsorption?.absorptionFraction ?? 0)
        : ingredient.grams;
    finalWeightG += grams;

    if (ingredient.retentionFactor === undefined) {
      hadUndocumentedRetention = true;
    }
    const retentionFactor = ingredient.retentionFactor ?? 1;

    if (ingredient.nutrientsPer100g === null) {
      missingNutrientIngredients.push(ingredient.name);
      continue; // Weight above already counted; nutrients deliberately not treated as zero.
    }
    addScaled(totals, ingredient.nutrientsPer100g, grams, retentionFactor);
  }

  if (finalWeightG <= 0) {
    return {
      tier: "unresolved",
      finalWeightG: null,
      totals: emptyTotals(),
      per100g: null,
      missingNutrientIngredients,
      unresolvedReasons: ["final weight resolved to 0g - every ingredient was an excluded cooking medium"],
    };
  }

  const per100gScale = 100 / finalWeightG;
  const per100g: RecipeNutrientProfile = {
    kcalPer100g: totals.kcal * per100gScale,
    proteinGPer100g: totals.proteinG * per100gScale,
    fatGPer100g: totals.fatG * per100gScale,
    carbGPer100g: totals.carbG * per100gScale,
    fibreGPer100g: totals.fibreG * per100gScale,
  };

  const tier: ConfidenceTier =
    missingNutrientIngredients.length > 0 || hadUndocumentedRetention ? "estimated" : "calculated";

  return { tier, finalWeightG, totals, per100g, missingNutrientIngredients, unresolvedReasons: [] };
}

/** Serving nutrient value = (per 100g value / 100) × serving weight (brief section 7's formula).
 * Returns null when the recipe itself couldn't be resolved. */
export function scaleToServing(result: RecipeCalcResult, servingGrams: number): RecipeNutrientProfile | null {
  if (!result.per100g) {
    return null;
  }
  const scale = servingGrams / 100;
  return {
    kcalPer100g: result.per100g.kcalPer100g * scale,
    proteinGPer100g: result.per100g.proteinGPer100g * scale,
    fatGPer100g: result.per100g.fatGPer100g * scale,
    carbGPer100g: result.per100g.carbGPer100g * scale,
    fibreGPer100g: result.per100g.fibreGPer100g * scale,
  };
}
