import { describe, expect, it } from "vitest";
import {
  calorieRingProgress,
  groupFoodLogByMeal,
  kcalRemaining,
  MEAL_DISPLAY_ORDER,
  sumKcal,
  type SummarizableFoodLogEntry,
} from "./meal-summary";

function entry(mealType: string, kcal: number | null): SummarizableFoodLogEntry {
  return { mealType, macros: kcal === null ? null : { kcal, proteinG: null, fatG: null, carbG: null } };
}

describe("groupFoodLogByMeal", () => {
  it("returns one group per meal type in display order, even when empty", () => {
    const groups = groupFoodLogByMeal([]);
    expect(groups.map((g) => g.mealType)).toEqual([...MEAL_DISPLAY_ORDER]);
    expect(groups.every((g) => g.entries.length === 0 && g.kcalSubtotal === 0)).toBe(true);
  });

  it("buckets entries by meal type and sums kcal per bucket", () => {
    const groups = groupFoodLogByMeal([
      entry("breakfast", 200),
      entry("breakfast", 150),
      entry("lunch", 500),
    ]);
    const breakfast = groups.find((g) => g.mealType === "breakfast")!;
    const lunch = groups.find((g) => g.mealType === "lunch")!;
    const dinner = groups.find((g) => g.mealType === "dinner")!;
    expect(breakfast.entries).toHaveLength(2);
    expect(breakfast.kcalSubtotal).toBe(350);
    expect(lunch.kcalSubtotal).toBe(500);
    expect(dinner.entries).toHaveLength(0);
  });

  it("treats a null-macro entry as 0 kcal rather than dropping it from its bucket", () => {
    const groups = groupFoodLogByMeal([entry("snack", null)]);
    const snack = groups.find((g) => g.mealType === "snack")!;
    expect(snack.entries).toHaveLength(1);
    expect(snack.kcalSubtotal).toBe(0);
  });

  it("drops an entry whose mealType isn't a recognized display bucket", () => {
    const groups = groupFoodLogByMeal([entry("midnight_feast", 999)]);
    const totalBucketed = groups.reduce((sum, g) => sum + g.entries.length, 0);
    expect(totalBucketed).toBe(0);
  });
});

describe("sumKcal", () => {
  it("sums across all entries regardless of meal type", () => {
    expect(sumKcal([entry("breakfast", 200), entry("dinner", 300), entry("lunch", null)])).toBe(500);
  });

  it("returns 0 for no entries", () => {
    expect(sumKcal([])).toBe(0);
  });
});

describe("calorieRingProgress", () => {
  it("is 0 when nothing eaten", () => {
    expect(calorieRingProgress(0, 2000)).toBe(0);
  });

  it("is a fraction between 0 and 1 under target", () => {
    expect(calorieRingProgress(1000, 2000)).toBeCloseTo(0.5);
  });

  it("clamps at 1 once over target, never exceeding it", () => {
    expect(calorieRingProgress(3000, 2000)).toBe(1);
  });

  it("is 0 when the target itself is non-positive, instead of dividing by zero", () => {
    expect(calorieRingProgress(500, 0)).toBe(0);
  });
});

describe("kcalRemaining", () => {
  it("is positive when under target", () => {
    expect(kcalRemaining(1500, 2000)).toBe(500);
  });

  it("is negative once over target - a real 'over budget' fact, not clamped to 0", () => {
    expect(kcalRemaining(2500, 2000)).toBe(-500);
  });
});
