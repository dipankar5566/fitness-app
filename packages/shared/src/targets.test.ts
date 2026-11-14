import { describe, expect, it } from "vitest";
import {
  calculateAgeYears,
  calculateBmr,
  calculateMacroTargets,
  calculateTdee,
  estimateOneRepMax,
  type UserBiometrics,
} from "./targets";

const rahul: UserBiometrics = {
  sex: "male",
  ageYears: 24,
  heightCm: 175,
  weightKg: 70,
  activityLevel: "moderate",
};

describe("calculateBmr", () => {
  it("matches Mifflin-St Jeor for a male", () => {
    // 10*70 + 6.25*175 - 5*24 + 5 = 700 + 1093.75 - 120 + 5 = 1678.75
    expect(calculateBmr(rahul)).toBeCloseTo(1678.75, 2);
  });

  it("subtracts 161 instead of adding 5 for a female", () => {
    const priya: UserBiometrics = { ...rahul, sex: "female", weightKg: 60, heightCm: 160 };
    // 10*60 + 6.25*160 - 5*24 - 161 = 600 + 1000 - 120 - 161 = 1319
    expect(calculateBmr(priya)).toBeCloseTo(1319, 2);
  });
});

describe("calculateTdee", () => {
  it("scales BMR by the activity factor", () => {
    expect(calculateTdee(rahul)).toBeCloseTo(calculateBmr(rahul) * 1.55, 2);
  });
});

describe("calculateMacroTargets", () => {
  it("reduces kcal below TDEE on a cut", () => {
    const tdee = calculateTdee(rahul);
    const { kcal } = calculateMacroTargets(rahul, "cut", true);
    expect(kcal).toBeLessThan(tdee);
    expect(kcal).toBeGreaterThan(tdee * 0.7); // within the -15..-20% band, not more extreme
  });

  it("raises kcal above TDEE on a bulk", () => {
    const tdee = calculateTdee(rahul);
    const { kcal } = calculateMacroTargets(rahul, "bulk", true);
    expect(kcal).toBeGreaterThan(tdee);
  });

  it("keeps kcal at TDEE on maintain", () => {
    const tdee = calculateTdee(rahul);
    const { kcal } = calculateMacroTargets(rahul, "maintain", true);
    expect(kcal).toBeCloseTo(tdee, 0);
  });

  it("gives the highest protein g/kg on a cut", () => {
    const cut = calculateMacroTargets(rahul, "cut", true);
    const bulk = calculateMacroTargets(rahul, "bulk", true);
    expect(cut.proteinG / rahul.weightKg).toBeGreaterThan(bulk.proteinG / rahul.weightKg);
  });

  it("gives more carbs on a training day than a rest day for the same weekly kcal goal", () => {
    const training = calculateMacroTargets(rahul, "maintain", true);
    const rest = calculateMacroTargets(rahul, "maintain", false);
    expect(training.carbG).toBeGreaterThan(rest.carbG);
    // kcal target itself doesn't change by day - only the carb split within it does
    expect(training.kcal).toBe(rest.kcal);
  });

  it("never drops fat below the 0.6 g/kg floor", () => {
    const { fatG } = calculateMacroTargets(rahul, "cut", true);
    expect(fatG).toBeGreaterThanOrEqual(Math.round(rahul.weightKg * 0.6));
  });

  it("runs well under the 50ms offline budget (PRD AC)", () => {
    const start = performance.now();
    calculateMacroTargets(rahul, "cut", true);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe("calculateAgeYears", () => {
  it("counts a full year once the birthday has passed this year", () => {
    expect(calculateAgeYears("2000-01-15", new Date("2024-06-01T00:00:00Z"))).toBe(24);
  });

  it("does not count this year's birthday until it has happened", () => {
    expect(calculateAgeYears("2000-12-15", new Date("2024-06-01T00:00:00Z"))).toBe(23);
  });

  it("counts the birthday itself as turned a year older", () => {
    expect(calculateAgeYears("2000-06-01", new Date("2024-06-01T00:00:00Z"))).toBe(24);
  });
});

describe("estimateOneRepMax", () => {
  it("returns the weight itself for a 1-rep set", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it("estimates a higher 1RM for multi-rep sets (Epley)", () => {
    // 100 * (1 + 5/30) = 116.67 -> rounded to 1dp = 116.7
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
  });
});
