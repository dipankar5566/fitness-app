import { describe, expect, it } from "vitest";
import {
  activeFast,
  completedFasts,
  eatingWindowEnd,
  fastingCaution,
  fastingProgress,
  FASTING_PRESETS,
  fastTargetReachedAt,
  formatFastingDuration,
} from "./fasting.ts";
import { FASTING_MAX_TARGET_MINUTES, FASTING_MIN_TARGET_MINUTES, fastingLogSchema } from "./schemas.ts";

const START = "2026-11-23T20:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("FASTING_PRESETS", () => {
  it("every preset fits inside the schema's safety bounds, none over 20h", () => {
    for (const preset of FASTING_PRESETS) {
      const minutes = preset.fastHours * 60;
      expect(minutes).toBeGreaterThanOrEqual(FASTING_MIN_TARGET_MINUTES);
      expect(minutes).toBeLessThanOrEqual(FASTING_MAX_TARGET_MINUTES);
      expect(preset.fastHours).toBeLessThanOrEqual(20);
      // label's fast + eat hours always make up one day
      const [fast, eat] = preset.label.split(":").map(Number);
      expect(fast).toBe(preset.fastHours);
      expect(fast + eat).toBe(24);
    }
  });

  it("the schema rejects a multi-day fast", () => {
    const base = {
      id: "11111111-1111-1111-1111-111111111111",
      accountId: "22222222-2222-2222-2222-222222222222",
      updatedAt: START,
      startedAt: START,
    };
    expect(fastingLogSchema.safeParse({ ...base, targetMinutes: 16 * 60 }).success).toBe(true);
    expect(fastingLogSchema.safeParse({ ...base, targetMinutes: 36 * 60 }).success).toBe(false);
  });
});

describe("fastingProgress", () => {
  it("elapsed grows and remaining shrinks over time, summing to the target until complete", () => {
    const early = fastingProgress(START, 960, at("2026-11-23T22:00:00.000Z"));
    const later = fastingProgress(START, 960, at("2026-11-24T04:00:00.000Z"));
    expect(later.elapsedMinutes).toBeGreaterThan(early.elapsedMinutes);
    expect(later.remainingMinutes).toBeLessThan(early.remainingMinutes);
    expect(early.elapsedMinutes + early.remainingMinutes).toBe(960);
    expect(later.fraction).toBeGreaterThan(early.fraction);
    expect(early.isComplete).toBe(false);
  });

  it("past the target: complete, remaining 0, fraction clamped to 1", () => {
    const p = fastingProgress(START, 960, at("2026-11-24T14:00:00.000Z"));
    expect(p.isComplete).toBe(true);
    expect(p.remainingMinutes).toBe(0);
    expect(p.fraction).toBe(1);
  });

  it("a clock before the start never goes negative", () => {
    const p = fastingProgress(START, 960, at("2026-11-23T19:00:00.000Z"));
    expect(p.elapsedMinutes).toBe(0);
    expect(p.fraction).toBe(0);
  });
});

describe("window boundaries", () => {
  it("the eating window opens at the target and closes 24h after the fast began", () => {
    const opens = fastTargetReachedAt(START, 16 * 60);
    const closes = eatingWindowEnd(START);
    expect(opens.toISOString()).toBe("2026-11-24T12:00:00.000Z");
    expect(closes.getTime() - opens.getTime()).toBe(8 * 3_600_000);
  });
});

describe("activeFast / completedFasts", () => {
  const rows = [
    { id: "a", startedAt: "2026-11-20T20:00:00.000Z", endedAt: "2026-11-21T12:30:00.000Z", targetMinutes: 960 },
    { id: "b", startedAt: "2026-11-21T20:00:00.000Z", endedAt: "2026-11-22T06:00:00.000Z", targetMinutes: 960 }, // ended early
    { id: "c", startedAt: "2026-11-22T20:00:00.000Z", endedAt: null, targetMinutes: 960, isDeleted: true },
    { id: "d", startedAt: START, endedAt: null, targetMinutes: 960 },
  ];

  it("picks the latest un-ended, non-deleted fast", () => {
    expect(activeFast(rows)?.id).toBe("d");
    expect(activeFast(rows.slice(0, 3))).toBeNull();
  });

  it("only counts fasts that reached their target", () => {
    expect(completedFasts(rows).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("formatFastingDuration", () => {
  it("formats hours and zero-padded minutes", () => {
    expect(formatFastingDuration(307)).toBe("5h 07m");
    expect(formatFastingDuration(42)).toBe("42m");
    expect(formatFastingDuration(-5)).toBe("0m");
  });
});

describe("fastingCaution", () => {
  it("flags a logged day below the 800 kcal restriction threshold", () => {
    expect(fastingCaution([1900, 650])).toBe(true);
  });

  it("does not treat an unlogged (0 kcal) day as a red flag", () => {
    expect(fastingCaution([0, 1800, 0])).toBe(false);
    expect(fastingCaution([])).toBe(false);
  });
});
