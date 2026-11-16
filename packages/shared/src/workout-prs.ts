/**
 * Lifetime PR tracking for workout sets — PRD §5.4 ("PRs (1RM est. Epley, rep PRs)"). Pure,
 * deterministic: fed by whatever sets the caller already has (the mobile app's local SQLite
 * mirror, which already holds the account's full workout_set history via /sync — ARCHITECTURE.md
 * §3), so this needs no I/O and no new API endpoint.
 */
import { estimateOneRepMax } from "./targets.ts";

export interface WorkoutSetForPr {
  reps: number;
  weightKg: number;
  isWarmup: boolean;
}

export interface ExercisePrSummary {
  /** Heaviest weight ever lifted for at least one rep, excluding warm-up sets. Null with no qualifying sets. */
  bestWeightKg: number | null;
  /** Best Epley-estimated 1RM across all non-warmup sets. Null with no qualifying sets. */
  bestEstimatedOneRm: number | null;
  /** For each distinct weight actually lifted, the most reps ever done at that weight (excluding
   * warm-ups) — a "rep PR" means beating this count at a weight already attempted before. */
  bestRepsByWeightKg: Record<number, number>;
}

export function summarizeExercisePrs(sets: WorkoutSetForPr[]): ExercisePrSummary {
  let bestWeightKg: number | null = null;
  let bestEstimatedOneRm: number | null = null;
  const bestRepsByWeightKg: Record<number, number> = {};

  for (const set of sets) {
    if (set.isWarmup || set.reps <= 0 || set.weightKg < 0) continue;

    if (bestWeightKg === null || set.weightKg > bestWeightKg) {
      bestWeightKg = set.weightKg;
    }
    const estimate = estimateOneRepMax(set.weightKg, set.reps);
    if (bestEstimatedOneRm === null || estimate > bestEstimatedOneRm) {
      bestEstimatedOneRm = estimate;
    }
    if (set.reps > (bestRepsByWeightKg[set.weightKg] ?? 0)) {
      bestRepsByWeightKg[set.weightKg] = set.reps;
    }
  }

  return { bestWeightKg, bestEstimatedOneRm, bestRepsByWeightKg };
}

export interface NewPrFlags {
  isWeightPr: boolean;
  isRepPr: boolean;
  isOneRmPr: boolean;
}

/**
 * Compares a freshly logged set against the summary of every *other* set already logged for this
 * exercise (call summarizeExercisePrs over the history *before* this set, then pass that in here)
 * to say which kind of record, if any, it just broke. A weight never attempted before registers as
 * a rep PR too (and a weight PR if it's heavier than ever) — that's intentional: a first attempt at
 * a new weight is itself a new best, not a non-event.
 */
export function detectNewPrs(priorSummary: ExercisePrSummary, newSet: WorkoutSetForPr): NewPrFlags {
  if (newSet.isWarmup || newSet.reps <= 0) {
    return { isWeightPr: false, isRepPr: false, isOneRmPr: false };
  }

  const isWeightPr = priorSummary.bestWeightKg === null || newSet.weightKg > priorSummary.bestWeightKg;
  const priorRepsAtWeight = priorSummary.bestRepsByWeightKg[newSet.weightKg] ?? 0;
  const isRepPr = newSet.reps > priorRepsAtWeight;
  const newEstimate = estimateOneRepMax(newSet.weightKg, newSet.reps);
  const isOneRmPr = priorSummary.bestEstimatedOneRm === null || newEstimate > priorSummary.bestEstimatedOneRm;

  return { isWeightPr, isRepPr, isOneRmPr };
}
