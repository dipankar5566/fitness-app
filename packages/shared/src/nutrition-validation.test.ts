import { describe, expect, it } from "vitest";
import {
  energyConsistency,
  servingPlausibility,
  validateNutrientProfile,
} from "./nutrition-validation.ts";

describe("validateNutrientProfile", () => {
  it("flags a negative macro value", () => {
    const flags = validateNutrientProfile({
      kcalPer100g: 100,
      proteinGPer100g: -1,
      fatGPer100g: 1,
      carbGPer100g: 1,
      fibreGPer100g: 0,
    });
    expect(flags.some((f) => f.rule === "negative_value")).toBe(true);
  });

  it("does not flag a null (missing) value as negative or otherwise wrong", () => {
    const flags = validateNutrientProfile({
      kcalPer100g: null,
      proteinGPer100g: null,
      fatGPer100g: null,
      carbGPer100g: null,
      fibreGPer100g: null,
    });
    expect(flags).toEqual([]);
  });

  it("flags protein+fat+carb exceeding 100g per 100g", () => {
    const flags = validateNutrientProfile({
      kcalPer100g: 500,
      proteinGPer100g: 40,
      fatGPer100g: 40,
      carbGPer100g: 40,
      fibreGPer100g: 0,
    });
    expect(flags.some((f) => f.rule === "mass_balance")).toBe(true);
  });

  it("does not flag a plausible high-protein, low-fat/carb profile", () => {
    const flags = validateNutrientProfile({
      kcalPer100g: 165,
      proteinGPer100g: 31,
      fatGPer100g: 3.6,
      carbGPer100g: 0,
      fibreGPer100g: 0,
    });
    expect(flags).toEqual([]);
  });
});

describe("energyConsistency", () => {
  it("does not flag a food within tolerance of its Atwater estimate", () => {
    // 10g protein + 2g fat + 20g carb = 40+18+80 = 138 kcal estimate; stated 140 is within 15%.
    const flags = energyConsistency(
      { kcalPer100g: 140, proteinGPer100g: 10, fatGPer100g: 2, carbGPer100g: 20, fibreGPer100g: 0 },
      { tolerance: 0.15 },
    );
    expect(flags).toEqual([]);
  });

  it("flags a food whose stated kcal is far below what its macros imply", () => {
    // Deep-fried pakora-style profile: 61g fat alone implies 549 kcal, but stated is only 150.
    const flags = energyConsistency(
      { kcalPer100g: 150, proteinGPer100g: 5, fatGPer100g: 61, carbGPer100g: 5, fibreGPer100g: 0 },
      { tolerance: 0.15 },
    );
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].severity).toBe("critical");
  });

  it("a high-fibre food's Atwater gap is only ever a flag, never a correction", () => {
    // Fibre is metabolized differently than other carbs, so a food like this can show a
    // borderline deviation purely from the 2 kcal/g fibre convention used for the cross-check.
    // The function must not throw or return anything resembling a replacement value.
    const flags = energyConsistency(
      { kcalPer100g: 200, proteinGPer100g: 5, fatGPer100g: 2, carbGPer100g: 30, fibreGPer100g: 25 },
      { tolerance: 0.15 },
    );
    for (const flag of flags) {
      expect(flag).not.toHaveProperty("correctedKcal");
    }
  });

  it("returns no flags when there is no kcal value to check against", () => {
    expect(
      energyConsistency(
        { kcalPer100g: null, proteinGPer100g: 10, fatGPer100g: 2, carbGPer100g: 20, fibreGPer100g: 0 },
        { tolerance: 0.15 },
      ),
    ).toEqual([]);
  });

  it("returns no flags when there are no macros to check the stated kcal against", () => {
    expect(
      energyConsistency(
        { kcalPer100g: 140, proteinGPer100g: null, fatGPer100g: null, carbGPer100g: null, fibreGPer100g: null },
        { tolerance: 0.15 },
      ),
    ).toEqual([]);
  });
});

describe("servingPlausibility", () => {
  it("flags an implausibly heavy 'egg' serving (the boiled-egg-plus-cooking-water bug)", () => {
    const flags = servingPlausibility("egg", 151);
    expect(flags.length).toBeGreaterThan(0);
  });

  it("does not flag a plausible 'egg' serving", () => {
    expect(servingPlausibility("egg", 50)).toEqual([]);
  });

  it("does not flag a unit name with no matching range at all", () => {
    expect(servingPlausibility("soup bowl", 999)).toEqual([]);
  });
});
