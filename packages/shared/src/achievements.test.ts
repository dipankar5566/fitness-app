import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  computeAchievements,
  countPrImprovements,
  LEVEL_THRESHOLDS,
  levelForPoints,
  longestLoggingStreak,
  type AchievementInput,
} from "./achievements.ts";

function days(start: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const EMPTY: AchievementInput = {
  loggedDates: [],
  workoutCount: 0,
  prImprovementCount: 0,
  waterGoalDays: 0,
  completedFastCount: 0,
};

describe("safety: nothing rewards eating less", () => {
  it("no badge is defined over calories, deficits or restriction", () => {
    const allowed = new Set([
      "longest_log_streak",
      "logged_days",
      "workouts",
      "pr_improvements",
      "water_goal_days",
      "completed_fasts",
    ]);
    for (const badge of ACHIEVEMENTS) {
      expect(allowed.has(badge.metric)).toBe(true);
      expect(`${badge.id} ${badge.title} ${badge.description}`).not.toMatch(
        /kcal|calori|deficit|under budget|lose|skip|restrict/i,
      );
    }
  });
});

describe("badge definitions", () => {
  it("have unique ids and thresholds that rise within each metric", () => {
    expect(new Set(ACHIEVEMENTS.map((b) => b.id)).size).toBe(ACHIEVEMENTS.length);
    const byMetric = new Map<string, number[]>();
    for (const b of ACHIEVEMENTS) byMetric.set(b.metric, [...(byMetric.get(b.metric) ?? []), b.threshold]);
    for (const thresholds of byMetric.values()) {
      expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
    }
  });
});

describe("longestLoggingStreak", () => {
  it("keeps the best run even after the streak breaks, so badges never re-lock", () => {
    expect(longestLoggingStreak([...days("2026-10-01", 10), ...days("2026-11-20", 2)])).toBe(10);
  });

  it("is 0 with no logs", () => {
    expect(longestLoggingStreak([])).toBe(0);
  });
});

describe("countPrImprovements", () => {
  const set = (exerciseId: string, sessionStartedAt: string, weightKg: number, reps: number, isWarmup = false) => ({
    exerciseId,
    sessionStartedAt,
    weightKg,
    reps,
    isWarmup,
  });

  it("treats the first session as a baseline, not a PR", () => {
    expect(countPrImprovements([set("bench", "2026-11-01", 60, 5)])).toBe(0);
  });

  it("counts a later session that beats weight or estimated 1RM, once per exercise-session", () => {
    expect(
      countPrImprovements([
        set("bench", "2026-11-01", 60, 5),
        set("bench", "2026-11-03", 62.5, 5),
        set("bench", "2026-11-03", 65, 3), // same session - still one PR
        set("bench", "2026-11-05", 60, 5), // no improvement
        set("bench", "2026-11-07", 60, 10), // more reps -> higher Epley 1RM
        set("squat", "2026-11-02", 100, 5), // squat baseline only
      ]),
    ).toBe(2);
  });

  it("ignores warm-up sets", () => {
    expect(countPrImprovements([set("bench", "2026-11-01", 60, 5), set("bench", "2026-11-03", 100, 5, true)])).toBe(0);
  });
});

describe("levelForPoints", () => {
  it("starts at level 1 and never goes down as points rise", () => {
    expect(levelForPoints(0).level).toBe(1);
    let previous = 0;
    for (let points = 0; points <= 12000; points += 50) {
      const { level } = levelForPoints(points);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
    expect(levelForPoints(LEVEL_THRESHOLDS[1]).level).toBe(2);
    expect(levelForPoints(LEVEL_THRESHOLDS[1] - 1).level).toBe(1);
  });

  it("caps at the top level with full progress", () => {
    const top = levelForPoints(1_000_000);
    expect(top.level).toBe(LEVEL_THRESHOLDS.length);
    expect(top.nextLevelAt).toBeNull();
    expect(top.levelProgress).toBe(1);
  });
});

describe("computeAchievements", () => {
  it("gives a brand-new account no badges, 0 points, level 1", () => {
    const summary = computeAchievements(EMPTY);
    expect(summary.badges.every((b) => !b.unlocked)).toBe(true);
    expect(summary.points).toBe(0);
    expect(summary.level).toBe(1);
  });

  it("unlocks a badge exactly at its threshold", () => {
    const below = computeAchievements({ ...EMPTY, workoutCount: 9 });
    const at = computeAchievements({ ...EMPTY, workoutCount: 10 });
    expect(below.badges.find((b) => b.id === "workout_10")?.unlocked).toBe(false);
    expect(at.badges.find((b) => b.id === "workout_10")).toMatchObject({ unlocked: true, progress: 10 });
  });

  it("never yields fewer points for more activity", () => {
    const a = computeAchievements({ ...EMPTY, loggedDates: days("2026-11-01", 5) });
    const b = computeAchievements({ ...EMPTY, loggedDates: days("2026-11-01", 5), workoutCount: 1, waterGoalDays: 1 });
    expect(b.points).toBeGreaterThan(a.points);
  });

  it("unlocks both the 3- and 7-day badges for a 7-day streak", () => {
    const unlocked = computeAchievements({ ...EMPTY, loggedDates: days("2026-11-17", 7) })
      .badges.filter((b) => b.unlocked)
      .map((b) => b.id);
    expect(unlocked).toEqual(expect.arrayContaining(["streak_3", "streak_7"]));
    expect(unlocked).not.toContain("streak_30");
  });
});
