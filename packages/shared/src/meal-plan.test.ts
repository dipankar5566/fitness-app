import { describe, expect, it } from "vitest";
import {
  itemMacros,
  PLAN_GRAMS_STEP,
  PLAN_KCAL_TOLERANCE,
  PLAN_SCALE_MAX,
  planTotals,
  scalePlanToTarget,
  validatePlanAgainstTargets,
  type MealPlanItem,
} from "./meal-plan.ts";

function item(foodRef: string, grams: number, kcalPer100g: number, proteinGPer100g: number): MealPlanItem {
  return {
    mealType: "lunch",
    foodSource: "indb",
    foodRef,
    foodName: foodRef,
    grams,
    kcalPer100g,
    proteinGPer100g,
    carbGPer100g: 10,
    fatGPer100g: 5,
  };
}

const TARGETS = { kcal: 2000, proteinG: 120, carbG: 220, fatG: 60 };

describe("itemMacros / planTotals", () => {
  it("scale linearly with grams", () => {
    const small = itemMacros(item("a", 100, 150, 10));
    const big = itemMacros(item("a", 200, 150, 10));
    expect(big.kcal).toBe(2 * small.kcal);
    expect(big.proteinG).toBeCloseTo(2 * small.proteinG);
  });

  it("totals are the sum of the items", () => {
    const items = [item("a", 100, 150, 10), item("b", 50, 400, 20)];
    expect(planTotals(items).kcal).toBe(150 + 200);
    expect(planTotals(items).proteinG).toBeCloseTo(10 + 10);
  });
});

describe("scalePlanToTarget", () => {
  it("moves an under-target plan to within tolerance, keeping item proportions", () => {
    const items = [item("a", 200, 300, 15), item("b", 100, 400, 25)]; // 1000 kcal
    const scaled = scalePlanToTarget(items, 1500);
    const total = planTotals(scaled).kcal;
    expect(Math.abs(total - 1500) / 1500).toBeLessThanOrEqual(PLAN_KCAL_TOLERANCE);
    expect(scaled[0].grams / scaled[1].grams).toBeCloseTo(2, 0);
  });

  it("rounds grams to the step and never exceeds the clamp", () => {
    const scaled = scalePlanToTarget([item("a", 100, 100, 5)], 10_000);
    expect(scaled[0].grams % PLAN_GRAMS_STEP).toBe(0);
    expect(scaled[0].grams).toBeLessThanOrEqual(100 * PLAN_SCALE_MAX);
  });

  it("does not mutate the input", () => {
    const items = [item("a", 100, 100, 5)];
    scalePlanToTarget(items, 500);
    expect(items[0].grams).toBe(100);
  });
});

describe("validatePlanAgainstTargets", () => {
  it("accepts a plan within ±5 % kcal with enough protein", () => {
    const items = [item("a", 1000, 200, 12.5)]; // 2000 kcal, 125 g protein
    expect(validatePlanAgainstTargets(items, TARGETS)).toMatchObject({ ok: true, problems: [] });
  });

  it("rejects a plan more than 5 % off the kcal target either way", () => {
    expect(validatePlanAgainstTargets([item("a", 1000, 180, 15)], TARGETS).ok).toBe(false); // 1800 = -10 %
    expect(validatePlanAgainstTargets([item("a", 1000, 220, 15)], TARGETS).ok).toBe(false); // 2200 = +10 %
  });

  it("rejects a kcal-correct plan that is short on protein, but allows extra protein", () => {
    const low = validatePlanAgainstTargets([item("a", 1000, 200, 5)], TARGETS);
    expect(low.ok).toBe(false);
    expect(low.problems.join(" ")).toMatch(/protein/i);
    expect(validatePlanAgainstTargets([item("a", 1000, 200, 25)], TARGETS).ok).toBe(true);
  });

  it("rejects an empty plan", () => {
    expect(validatePlanAgainstTargets([], TARGETS).ok).toBe(false);
  });
});
