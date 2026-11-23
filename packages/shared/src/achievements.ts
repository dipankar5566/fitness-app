/**
 * Gamification - points, levels and badges (HealthifyMe-informed idea, clean-room). Pure and fully
 * derived: every input is something apps/mobile already has in its local synced mirror (food_log
 * dates, workout sets, water_log, fasting_log), so nothing new is stored or synced - the same "derive
 * it from what's already there" pattern as streak.ts and workout-prs.ts. Which badges the user has
 * already *seen* is a per-device UI concern (kv), not part of this computation.
 *
 * Safety rule (pinned by achievements.test.ts): nothing here rewards eating less. Every metric is
 * consistency, training, hydration, or a fast completed within the app's own capped presets - there is
 * deliberately no calorie-based metric at all, so a "lowest kcal" or "under budget" badge can't exist.
 */
import { computeLoggingStreak } from "./streak.ts";
import { estimateOneRepMax } from "./targets.ts";

export type AchievementMetric =
  | "longest_log_streak"
  | "logged_days"
  | "workouts"
  | "pr_improvements"
  | "water_goal_days"
  | "completed_fasts";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  metric: AchievementMetric;
  threshold: number;
  /** MaterialCommunityIcons name - display only. */
  icon: string;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: "streak_3", title: "Warming up", description: "Log food 3 days in a row", metric: "longest_log_streak", threshold: 3, icon: "fire" },
  { id: "streak_7", title: "One full week", description: "Log food 7 days in a row", metric: "longest_log_streak", threshold: 7, icon: "fire" },
  { id: "streak_30", title: "Habit formed", description: "Log food 30 days in a row", metric: "longest_log_streak", threshold: 30, icon: "fire-circle" },
  { id: "streak_100", title: "Centurion", description: "Log food 100 days in a row", metric: "longest_log_streak", threshold: 100, icon: "crown" },
  { id: "logged_days_50", title: "Diary keeper", description: "Log food on 50 different days", metric: "logged_days", threshold: 50, icon: "notebook" },
  { id: "workout_1", title: "First rep", description: "Log your first workout", metric: "workouts", threshold: 1, icon: "dumbbell" },
  { id: "workout_10", title: "Regular", description: "Log 10 workouts", metric: "workouts", threshold: 10, icon: "dumbbell" },
  { id: "workout_50", title: "Iron habit", description: "Log 50 workouts", metric: "workouts", threshold: 50, icon: "weight-lifter" },
  { id: "pr_1", title: "Personal best", description: "Beat a previous best on any lift", metric: "pr_improvements", threshold: 1, icon: "trophy" },
  { id: "pr_10", title: "Getting stronger", description: "Set 10 personal bests", metric: "pr_improvements", threshold: 10, icon: "trophy-award" },
  { id: "water_7", title: "Hydrated", description: "Hit your water goal on 7 days", metric: "water_goal_days", threshold: 7, icon: "cup-water" },
  { id: "water_30", title: "Well watered", description: "Hit your water goal on 30 days", metric: "water_goal_days", threshold: 30, icon: "water" },
  { id: "fast_1", title: "First fast", description: "Complete a fast", metric: "completed_fasts", threshold: 1, icon: "timer-sand" },
  { id: "fast_10", title: "Steady rhythm", description: "Complete 10 fasts", metric: "completed_fasts", threshold: 10, icon: "timer-sand-complete" },
];

/** Points per qualifying event - consistency and training weigh most. The streak metric earns
 * points only through its badges, since every streak day is already counted in logged_days. */
export const POINTS_PER: Record<Exclude<AchievementMetric, "longest_log_streak">, number> = {
  logged_days: 10,
  workouts: 20,
  pr_improvements: 15,
  water_goal_days: 5,
  completed_fasts: 10,
};
export const POINTS_PER_BADGE = 50;

/** Points needed to *reach* each level (index 0 = level 1). */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, 10000];

export interface AchievementInput {
  /** Distinct YYYY-MM-DD days with at least one food log (the same input streak.ts takes). */
  loggedDates: readonly string[];
  workoutCount: number;
  prImprovementCount: number;
  waterGoalDays: number;
  completedFastCount: number;
}

export interface BadgeStatus extends AchievementDefinition {
  unlocked: boolean;
  /** Current value of the badge's metric, capped at the threshold - for a progress bar. */
  progress: number;
}

export interface AchievementSummary {
  badges: BadgeStatus[];
  points: number;
  level: number;
  /** Points needed for the next level, or null at the top level. */
  nextLevelAt: number | null;
  /** 0..1 progress from the current level's threshold to the next one (1 at the top level). */
  levelProgress: number;
}

/** Longest logging streak ever (not just the current one) - a badge, once earned, must never
 * re-lock because the streak later broke. Uses streak.ts's same forgiving 1-freeze/week rule,
 * evaluated as if each logged day were "today". */
export function longestLoggingStreak(loggedDates: readonly string[]): number {
  let longest = 0;
  for (const date of new Set(loggedDates)) {
    longest = Math.max(longest, computeLoggingStreak(loggedDates, date).length);
  }
  return longest;
}

export interface SetForPrCount {
  exerciseId: string;
  /** Anything that sorts chronologically - the ISO start time of the set's session. */
  sessionStartedAt: string;
  reps: number;
  weightKg: number;
  isWarmup: boolean;
}

/**
 * Counts sessions that beat an exercise's previous best (heavier weight or a higher Epley 1RM), at
 * most one per exercise per session. An exercise's first-ever session only sets a baseline and is
 * *not* counted - otherwise "personal best" would just mean "logged a set".
 */
export function countPrImprovements(sets: readonly SetForPrCount[]): number {
  const byExercise = new Map<string, Map<string, { weight: number; oneRm: number }>>();
  for (const set of sets) {
    if (set.isWarmup || set.reps <= 0 || set.weightKg <= 0) continue;
    const sessions = byExercise.get(set.exerciseId) ?? new Map<string, { weight: number; oneRm: number }>();
    const best = sessions.get(set.sessionStartedAt) ?? { weight: 0, oneRm: 0 };
    best.weight = Math.max(best.weight, set.weightKg);
    best.oneRm = Math.max(best.oneRm, estimateOneRepMax(set.weightKg, set.reps));
    sessions.set(set.sessionStartedAt, best);
    byExercise.set(set.exerciseId, sessions);
  }

  let count = 0;
  for (const sessions of byExercise.values()) {
    const ordered = [...sessions.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    let bestWeight = 0;
    let bestOneRm = 0;
    ordered.forEach(([, session], index) => {
      if (index > 0 && (session.weight > bestWeight || session.oneRm > bestOneRm)) count++;
      bestWeight = Math.max(bestWeight, session.weight);
      bestOneRm = Math.max(bestOneRm, session.oneRm);
    });
  }
  return count;
}

export function levelForPoints(points: number): Pick<AchievementSummary, "level" | "nextLevelAt" | "levelProgress"> {
  let index = 0;
  while (index + 1 < LEVEL_THRESHOLDS.length && points >= LEVEL_THRESHOLDS[index + 1]) index++;
  const floor = LEVEL_THRESHOLDS[index];
  const next = index + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[index + 1] : null;
  const levelProgress = next === null ? 1 : (points - floor) / (next - floor);
  return { level: index + 1, nextLevelAt: next, levelProgress };
}

export function computeAchievements(input: AchievementInput): AchievementSummary {
  const metrics: Record<AchievementMetric, number> = {
    longest_log_streak: longestLoggingStreak(input.loggedDates),
    logged_days: new Set(input.loggedDates).size,
    workouts: input.workoutCount,
    pr_improvements: input.prImprovementCount,
    water_goal_days: input.waterGoalDays,
    completed_fasts: input.completedFastCount,
  };

  const badges = ACHIEVEMENTS.map((definition) => {
    const value = metrics[definition.metric];
    return { ...definition, unlocked: value >= definition.threshold, progress: Math.min(value, definition.threshold) };
  });

  let points = badges.filter((badge) => badge.unlocked).length * POINTS_PER_BADGE;
  for (const [metric, perEvent] of Object.entries(POINTS_PER) as [keyof typeof POINTS_PER, number][]) {
    points += metrics[metric] * perEvent;
  }

  return { badges, points, ...levelForPoints(points) };
}
