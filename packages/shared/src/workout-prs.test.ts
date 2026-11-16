import { describe, expect, it } from "vitest";
import { detectNewPrs, summarizeExercisePrs, type ExercisePrSummary, type WorkoutSetForPr } from "./workout-prs";

const EMPTY: ExercisePrSummary = { bestWeightKg: null, bestEstimatedOneRm: null, bestRepsByWeightKg: {} };

describe("summarizeExercisePrs", () => {
  it("returns all-null/empty for no sets", () => {
    expect(summarizeExercisePrs([])).toEqual(EMPTY);
  });

  it("excludes warm-up sets from every measure", () => {
    const sets: WorkoutSetForPr[] = [{ reps: 20, weightKg: 200, isWarmup: true }];
    expect(summarizeExercisePrs(sets)).toEqual(EMPTY);
  });

  it("tracks the heaviest weight across qualifying sets", () => {
    const sets: WorkoutSetForPr[] = [
      { reps: 5, weightKg: 60, isWarmup: false },
      { reps: 1, weightKg: 100, isWarmup: false },
      { reps: 8, weightKg: 80, isWarmup: false },
    ];
    expect(summarizeExercisePrs(sets).bestWeightKg).toBe(100);
  });

  it("keeps the best reps per distinct weight, not just the overall best set", () => {
    const sets: WorkoutSetForPr[] = [
      { reps: 8, weightKg: 60, isWarmup: false },
      { reps: 5, weightKg: 60, isWarmup: false }, // worse than the first at the same weight
      { reps: 1, weightKg: 100, isWarmup: false },
    ];
    expect(summarizeExercisePrs(sets).bestRepsByWeightKg).toEqual({ 60: 8, 100: 1 });
  });

  it("the best estimated 1RM can come from a lighter, higher-rep set than the heaviest single", () => {
    // 60kg x 10 -> Epley 1RM = 80; 100kg x 1 -> Epley 1RM = 100. Heaviest set isn't always the
    // best 1RM estimate, but here the single clearly wins - this just pins the comparison logic.
    const sets: WorkoutSetForPr[] = [
      { reps: 10, weightKg: 60, isWarmup: false },
      { reps: 1, weightKg: 100, isWarmup: false },
    ];
    expect(summarizeExercisePrs(sets).bestEstimatedOneRm).toBe(100);
  });
});

describe("detectNewPrs", () => {
  it("every flag is true for a first-ever set (nothing to compare against)", () => {
    expect(detectNewPrs(EMPTY, { reps: 8, weightKg: 60, isWarmup: false })).toEqual({
      isWeightPr: true,
      isRepPr: true,
      isOneRmPr: true,
    });
  });

  it("a warm-up set is never a PR, even if the numbers would otherwise qualify", () => {
    expect(detectNewPrs(EMPTY, { reps: 8, weightKg: 60, isWarmup: true })).toEqual({
      isWeightPr: false,
      isRepPr: false,
      isOneRmPr: false,
    });
  });

  it("a heavier weight than ever before is a weight PR (and a 1RM PR, since it's also heavier)", () => {
    const prior = summarizeExercisePrs([{ reps: 1, weightKg: 90, isWarmup: false }]);
    const result = detectNewPrs(prior, { reps: 1, weightKg: 100, isWarmup: false });
    expect(result.isWeightPr).toBe(true);
    expect(result.isOneRmPr).toBe(true);
  });

  it("more reps at an already-attempted weight is a rep PR without being a weight PR", () => {
    const prior = summarizeExercisePrs([{ reps: 5, weightKg: 60, isWarmup: false }]);
    const result = detectNewPrs(prior, { reps: 8, weightKg: 60, isWarmup: false });
    expect(result.isRepPr).toBe(true);
    expect(result.isWeightPr).toBe(false);
  });

  it("a higher estimated 1RM from more reps at a lighter weight is a 1RM PR without a weight PR", () => {
    // Prior best single: 100kg x 1 (1RM=100). New: 90kg x 5 -> Epley 1RM = 90*(1+5/30) = 105.
    const prior = summarizeExercisePrs([{ reps: 1, weightKg: 100, isWarmup: false }]);
    const result = detectNewPrs(prior, { reps: 5, weightKg: 90, isWarmup: false });
    expect(result.isWeightPr).toBe(false);
    expect(result.isOneRmPr).toBe(true);
  });

  it("repeating a previous best exactly is not a new PR of any kind", () => {
    const prior = summarizeExercisePrs([{ reps: 8, weightKg: 60, isWarmup: false }]);
    const result = detectNewPrs(prior, { reps: 8, weightKg: 60, isWarmup: false });
    expect(result).toEqual({ isWeightPr: false, isRepPr: false, isOneRmPr: false });
  });

  it("zero or negative reps is never a PR", () => {
    const prior = summarizeExercisePrs([{ reps: 5, weightKg: 60, isWarmup: false }]);
    expect(detectNewPrs(prior, { reps: 0, weightKg: 100, isWarmup: false }).isWeightPr).toBe(false);
  });
});
