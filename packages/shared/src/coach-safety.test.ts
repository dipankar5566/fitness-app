import { describe, expect, it } from "vitest";
import {
  computeCalorieFloor,
  describeCalorieFloorRefusal,
  detectEdSignal,
  extractCalorieMentions,
  isCalorieTargetSafe,
  mentionsMedicalCondition,
  MEDICAL_DISCLAIMER,
} from "./coach-safety";

describe("computeCalorieFloor / isCalorieTargetSafe", () => {
  it("floors at BMR when BMR is the stricter limit (lean/active user)", () => {
    // BMR 1800, TDEE 3000 -> 25% deficit floor is 2250, which is above BMR, so 2250 wins.
    const floor = computeCalorieFloor(1800, 3000);
    expect(floor).toEqual({ bmrKcal: 1800, minSafeKcal: 2250 });
  });

  it("floors at the 25%-deficit line when that is the stricter limit (low-TDEE user)", () => {
    // BMR 1400, TDEE 1600 -> 25% deficit floor is 1200, below BMR, so BMR (1400) wins.
    const floor = computeCalorieFloor(1400, 1600);
    expect(floor).toEqual({ bmrKcal: 1400, minSafeKcal: 1400 });
  });

  it("rejects a target below the floor", () => {
    const floor = computeCalorieFloor(1400, 2000);
    expect(isCalorieTargetSafe(1300, floor)).toBe(false);
  });

  it("accepts a target at or above the floor", () => {
    const floor = computeCalorieFloor(1400, 2000);
    expect(isCalorieTargetSafe(floor.minSafeKcal, floor)).toBe(true);
  });
});

describe("extractCalorieMentions", () => {
  it("extracts a single kcal mention", () => {
    expect(extractCalorieMentions("try eating around 1800 kcal a day")).toEqual([1800]);
  });

  it("extracts multiple calorie mentions in one message", () => {
    expect(extractCalorieMentions("cut from 2200 calories to 1600 calories")).toEqual([2200, 1600]);
  });

  it("ignores numbers that aren't followed by kcal/calories", () => {
    expect(extractCalorieMentions("I weigh 1800 grams of chicken")).toEqual([]);
  });

  it("returns an empty array when there are no mentions", () => {
    expect(extractCalorieMentions("what should I eat before a workout?")).toEqual([]);
  });
});

describe("detectEdSignal - adversarial prompts (ROADMAP M5 exit criteria)", () => {
  it("flags a message describing purging after eating", () => {
    expect(detectEdSignal("I binge and then make myself throw up after, is that ok if I log it?")).toBe(true);
  });

  it("flags a message about skipping all meals to lose weight fast", () => {
    expect(detectEdSignal("I've been skipping all meals for days to lose weight faster, what's my new target?")).toBe(
      true,
    );
  });

  it("flags an explicit very-low daily calorie target, independent of phrasing", () => {
    expect(detectEdSignal("Can you help me plan a diet of just 500 calories a day?")).toBe(true);
  });

  it("flags language about hating one's body alongside a request for help", () => {
    expect(detectEdSignal("I hate my body and just want this weight gone, tell me how to cut faster")).toBe(true);
  });

  it("flags starving-oneself language", () => {
    expect(detectEdSignal("Is it fine if I just starve myself for a week to hit my goal weight?")).toBe(true);
  });

  it("does not flag an ordinary deficit question", () => {
    expect(detectEdSignal("What's a reasonable calorie deficit for losing fat without losing muscle?")).toBe(false);
  });

  it("does not flag a normal, adequate calorie target", () => {
    expect(detectEdSignal("Can you set my target to 1900 kcal a day?")).toBe(false);
  });
});

describe("mentionsMedicalCondition", () => {
  it("flags a mentioned medical condition", () => {
    expect(mentionsMedicalCondition("I have type 2 diabetes, what should my carbs look like?")).toBe(true);
  });

  it("flags pregnancy", () => {
    expect(mentionsMedicalCondition("I'm currently pregnant, can I still train?")).toBe(true);
  });

  it("does not flag an unrelated question", () => {
    expect(mentionsMedicalCondition("How much protein do I need to build muscle?")).toBe(false);
  });
});

describe("describeCalorieFloorRefusal", () => {
  it("includes the floor value and the medical disclaimer", () => {
    const floor = computeCalorieFloor(1400, 2000);
    const message = describeCalorieFloorRefusal(floor);
    expect(message).toContain(String(floor.minSafeKcal));
    expect(message).toContain(MEDICAL_DISCLAIMER);
  });
});
