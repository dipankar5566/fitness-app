import { describe, expect, it } from "vitest";
import { calculateRecipeNutrition, scaleToServing, type RecipeIngredientLine } from "./recipe-calc.ts";

// Real per-100g figures from the live indb database (psql-verified), used so these tests double
// as a regression check against the exact cases in docs/FOOD_DATABASE_AUDIT.md.
const RAW_EGG: RecipeIngredientLine["nutrientsPer100g"] = {
  kcalPer100g: 143,
  proteinGPer100g: 12.6,
  fatGPer100g: 9.5,
  carbGPer100g: 0.7,
  fibreGPer100g: 0,
};
const OIL: RecipeIngredientLine["nutrientsPer100g"] = {
  kcalPer100g: 884,
  proteinGPer100g: 0,
  fatGPer100g: 100,
  carbGPer100g: 0,
  fibreGPer100g: 0,
};
const LENTIL: RecipeIngredientLine["nutrientsPer100g"] = {
  kcalPer100g: 343,
  proteinGPer100g: 22.3,
  fatGPer100g: 1.7,
  carbGPer100g: 57.6,
  fibreGPer100g: 25.6,
};
const GHEE: RecipeIngredientLine["nutrientsPer100g"] = {
  kcalPer100g: 900,
  proteinGPer100g: 0,
  fatGPer100g: 100,
  carbGPer100g: 0,
  fibreGPer100g: 0,
};
const RICE_RAW: RecipeIngredientLine["nutrientsPer100g"] = {
  kcalPer100g: 374,
  proteinGPer100g: 7.9,
  fatGPer100g: 0.6,
  carbGPer100g: 80.5,
  fibreGPer100g: 1,
};
const RICE_COOKED: RecipeIngredientLine["nutrientsPer100g"] = {
  kcalPer100g: 130,
  proteinGPer100g: 2.7,
  fatGPer100g: 0.3,
  carbGPer100g: 28.2,
  fibreGPer100g: 0.4,
};

describe("calculateRecipeNutrition", () => {
  it("boiled egg: excludes the boiling water's weight entirely, landing close to the raw egg's own per-100g value", () => {
    const result = calculateRecipeNutrition({
      ingredients: [
        { name: "Egg", role: "contributing", grams: 50, nutrientsPer100g: RAW_EGG },
        { name: "Water", role: "excluded_cooking_medium", grams: 100, nutrientsPer100g: null },
      ],
    });
    expect(result.finalWeightG).toBe(50);
    expect(result.per100g!.kcalPer100g).toBeCloseTo(143, 0);
    // This is the fix for the audit's confirmed bug: the live app currently stores 45 kcal/100g
    // for "Boiled egg" because it divides by egg+water weight (150g) instead of just the egg.
    expect(result.per100g!.kcalPer100g).toBeGreaterThan(100);
  });

  it("fried egg has higher kcal/100g than boiled egg, via absorbed oil rather than the full pan quantity", () => {
    const boiled = calculateRecipeNutrition({
      ingredients: [
        { name: "Egg", role: "contributing", grams: 50, nutrientsPer100g: RAW_EGG },
        { name: "Water", role: "excluded_cooking_medium", grams: 100, nutrientsPer100g: null },
      ],
    });
    const friedWithOil = calculateRecipeNutrition({
      ingredients: [
        { name: "Egg", role: "contributing", grams: 50, nutrientsPer100g: RAW_EGG },
        { name: "Oil", role: "frying_medium", grams: 30, nutrientsPer100g: OIL },
      ],
      fryingAbsorption: { absorptionFraction: 0.1, source: "test fixture" },
    });
    expect(friedWithOil.finalWeightG).toBeCloseTo(53, 1); // 50g egg + 30g*0.1 absorbed oil = 53g
    expect(friedWithOil.per100g!.kcalPer100g).toBeGreaterThan(boiled.per100g!.kcalPer100g);
    expect(friedWithOil.per100g!.fatGPer100g).toBeGreaterThan(boiled.per100g!.fatGPer100g);
  });

  it("absorbed-oil frying (documented fraction) yields far less fat per 100g than naively treating the whole pan quantity as eaten", () => {
    // Ratios modelled on the real OSR119 "Banana chips" recipe: a batch-sized base food fried in
    // a literal "2 cups" (480g) pan quantity of oil, as INDB's own ingredient line records it.
    const absorbedResult = calculateRecipeNutrition({
      ingredients: [
        { name: "Banana", role: "contributing", grams: 400, nutrientsPer100g: RICE_COOKED }, // stand-in base food
        { name: "Oil", role: "frying_medium", grams: 480, nutrientsPer100g: OIL }, // "2 cups" pan quantity, as INDB records it
      ],
      fryingAbsorption: { absorptionFraction: 0.08, source: "test fixture" },
    });
    const naiveFullOilResult = calculateRecipeNutrition({
      ingredients: [
        { name: "Banana", role: "contributing", grams: 400, nutrientsPer100g: RICE_COOKED },
        { name: "Oil", role: "contributing", grams: 480, nutrientsPer100g: OIL }, // the current (wrong) behaviour
      ],
    });
    expect(absorbedResult.per100g!.fatGPer100g).toBeLessThan(naiveFullOilResult.per100g!.fatGPer100g);
    // The documented-absorption figure should be in a physically plausible range, not just "less".
    expect(absorbedResult.per100g!.fatGPer100g).toBeLessThan(15);
    expect(naiveFullOilResult.per100g!.fatGPer100g).toBeGreaterThan(50);
  });

  it("a frying_medium ingredient with no supplied absorption factor makes the recipe unresolved, not silently 0% or 100% absorbed", () => {
    const result = calculateRecipeNutrition({
      ingredients: [
        { name: "Potato", role: "contributing", grams: 100, nutrientsPer100g: RICE_COOKED },
        { name: "Oil", role: "frying_medium", grams: 480, nutrientsPer100g: OIL },
      ],
    });
    expect(result.tier).toBe("unresolved");
    expect(result.finalWeightG).toBeNull();
    expect(result.per100g).toBeNull();
    expect(result.unresolvedReasons.length).toBeGreaterThan(0);
  });

  it("dal with tadka has higher fat and kcal per 100g than plain dal", () => {
    const plainDal = calculateRecipeNutrition({
      ingredients: [
        { name: "Lentil", role: "contributing", grams: 50, nutrientsPer100g: LENTIL },
        { name: "Water", role: "excluded_cooking_medium", grams: 300, nutrientsPer100g: null },
      ],
    });
    const dalWithTadka = calculateRecipeNutrition({
      ingredients: [
        { name: "Lentil", role: "contributing", grams: 50, nutrientsPer100g: LENTIL },
        { name: "Water", role: "excluded_cooking_medium", grams: 300, nutrientsPer100g: null },
        { name: "Ghee", role: "contributing", grams: 10, nutrientsPer100g: GHEE },
      ],
    });
    expect(dalWithTadka.per100g!.fatGPer100g).toBeGreaterThan(plainDal.per100g!.fatGPer100g);
    expect(dalWithTadka.per100g!.kcalPer100g).toBeGreaterThan(plainDal.per100g!.kcalPer100g);
  });

  it("using a 'cooked rice' nutrient profile vs a 'raw rice' profile for the same grams gives a materially different result (the engine faithfully reflects whichever prep-state source it's given)", () => {
    const withRaw = calculateRecipeNutrition({
      ingredients: [{ name: "Rice", role: "contributing", grams: 100, nutrientsPer100g: RICE_RAW }],
    });
    const withCooked = calculateRecipeNutrition({
      ingredients: [{ name: "Rice", role: "contributing", grams: 100, nutrientsPer100g: RICE_COOKED }],
    });
    expect(withRaw.per100g!.kcalPer100g).toBeGreaterThan(withCooked.per100g!.kcalPer100g * 2);
  });

  it("an ingredient with unknown nutrients is excluded from totals but flagged, never treated as contributing 0 silently", () => {
    const result = calculateRecipeNutrition({
      ingredients: [
        { name: "Chicken breast", role: "contributing", grams: 100, nutrientsPer100g: RAW_EGG }, // stand-in
        { name: "Paneer", role: "contributing", grams: 50, nutrientsPer100g: null }, // the real L003 gap
      ],
    });
    expect(result.missingNutrientIngredients).toContain("Paneer");
    expect(result.tier).not.toBe("calculated"); // missing data must cap the confidence tier
    expect(result.finalWeightG).toBe(150); // but its physical weight still counts
  });

  it("calling it twice with the same input is idempotent (pure function, no hidden state)", () => {
    const input = {
      ingredients: [
        { name: "Lentil", role: "contributing" as const, grams: 50, nutrientsPer100g: LENTIL },
        { name: "Oil", role: "frying_medium" as const, grams: 20, nutrientsPer100g: OIL },
      ],
      fryingAbsorption: { absorptionFraction: 0.1, source: "test fixture" },
    };
    const first = calculateRecipeNutrition(input);
    const second = calculateRecipeNutrition(input);
    expect(second).toEqual(first);
  });
});

describe("scaleToServing", () => {
  it("a 150g serving is not the same as a 250g serving of the same recipe", () => {
    const recipe = calculateRecipeNutrition({
      ingredients: [{ name: "Lentil", role: "contributing", grams: 100, nutrientsPer100g: LENTIL }],
    });
    const serving150 = scaleToServing(recipe, 150)!;
    const serving250 = scaleToServing(recipe, 250)!;
    expect(serving150.kcalPer100g).not.toBeCloseTo(serving250.kcalPer100g, 0);
    expect(serving250.kcalPer100g / serving150.kcalPer100g).toBeCloseTo(250 / 150, 2);
  });

  it("returns null for an unresolved recipe rather than a fabricated serving value", () => {
    const unresolved = calculateRecipeNutrition({
      ingredients: [{ name: "Oil", role: "frying_medium", grams: 480, nutrientsPer100g: OIL }],
    });
    expect(scaleToServing(unresolved, 150)).toBeNull();
  });
});
