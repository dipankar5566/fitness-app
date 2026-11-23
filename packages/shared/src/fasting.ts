/**
 * Intermittent-fasting window math - PRD §5.1 ("fasting day / IF window mode"). Pure and
 * deterministic: the caller passes fasting_log rows (apps/mobile's local mirror, synced via
 * 0011_fasting_log.sql) and "now", nothing here does I/O or reads the clock itself.
 *
 * Safety rails, deliberately not configurable from the UI: presets stop at 20h, and the table/schema
 * cap any fast at 23h (FASTING_MAX_TARGET_MINUTES) - no multi-day fasting. fastingCaution() hides the
 * "start fast" action when recent logs already look like severe restriction (same <800 kcal/day
 * threshold the coach's ED-signal check uses), surfacing support resources instead.
 */
import { ED_SIGNAL_CALORIE_THRESHOLD } from "./coach-safety.ts";

export interface FastingPreset {
  /** Display label, "fast:eat" hours - e.g. "16:8". */
  label: string;
  fastHours: number;
}

export const FASTING_PRESETS: readonly FastingPreset[] = [
  { label: "12:12", fastHours: 12 },
  { label: "14:10", fastHours: 14 },
  { label: "16:8", fastHours: 16 },
  { label: "18:6", fastHours: 18 },
  { label: "20:4", fastHours: 20 },
];

/** The minimal shape these helpers need - structurally compatible with FastingLog and the mobile
 * repo's row type, without depending on either. */
export interface FastingRow {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  targetMinutes: number;
  isDeleted?: boolean;
}

export interface FastingProgress {
  elapsedMinutes: number;
  /** 0 once the target is reached - never negative. */
  remainingMinutes: number;
  /** elapsed / target, clamped to [0, 1] for a progress ring. */
  fraction: number;
  isComplete: boolean;
}

const MS_PER_MINUTE = 60_000;

/** Progress of a fast at `now` (or at its own endedAt, for a finished fast - pass that as `now`). */
export function fastingProgress(startedAt: string, targetMinutes: number, now: Date): FastingProgress {
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - Date.parse(startedAt)) / MS_PER_MINUTE));
  const remainingMinutes = Math.max(0, targetMinutes - elapsedMinutes);
  const fraction = targetMinutes > 0 ? Math.min(1, elapsedMinutes / targetMinutes) : 0;
  return { elapsedMinutes, remainingMinutes, fraction, isComplete: elapsedMinutes >= targetMinutes };
}

/** When the target will be reached - the moment the eating window opens. */
export function fastTargetReachedAt(startedAt: string, targetMinutes: number): Date {
  return new Date(Date.parse(startedAt) + targetMinutes * MS_PER_MINUTE);
}

/** When the eating window closes: the rest of the 24h cycle after the target is reached (e.g. a
 * 16h fast leaves an 8h window). */
export function eatingWindowEnd(startedAt: string): Date {
  return new Date(Date.parse(startedAt) + 24 * 60 * MS_PER_MINUTE);
}

/** The single in-progress fast (latest-started, not ended, not deleted), or null. */
export function activeFast<T extends FastingRow>(rows: readonly T[]): T | null {
  let latest: T | null = null;
  for (const row of rows) {
    if (row.isDeleted || row.endedAt) continue;
    if (!latest || Date.parse(row.startedAt) > Date.parse(latest.startedAt)) latest = row;
  }
  return latest;
}

/** Ended, non-deleted fasts that actually reached their target - ending early doesn't count. */
export function completedFasts<T extends FastingRow>(rows: readonly T[]): T[] {
  return rows.filter(
    (row) =>
      !row.isDeleted &&
      !!row.endedAt &&
      fastingProgress(row.startedAt, row.targetMinutes, new Date(row.endedAt)).isComplete,
  );
}

/** Formats a minute count as "5h 07m" (or "42m" under an hour) for the timer card. */
export function formatFastingDuration(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * True when recent *completed, logged* days look like severe restriction, so the fasting card
 * should show support resources instead of offering to start another fast. Pass the kcal totals of
 * recent past days (not today - a morning's near-zero total is normal mid-day, not a signal). A day
 * with nothing logged (0) is treated as "unknown", not as a red flag, so forgetting to log doesn't
 * trip it; erring toward caution otherwise, same direction as coach-safety.ts.
 */
export function fastingCaution(pastDaysKcal: readonly number[]): boolean {
  return pastDaysKcal.some((kcal) => kcal > 0 && kcal < ED_SIGNAL_CALORIE_THRESHOLD);
}
