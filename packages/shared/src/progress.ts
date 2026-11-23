/**
 * Pure aggregation helpers for the mobile Progress tab (7d/30d trends). Kept here, not in
 * apps/mobile, per the "formulas stay pure and fully unit-tested" rule - these take a structural
 * shape compatible with apps/mobile's repo query results without importing from apps/mobile.
 * No I/O: callers pass in whatever the local SQLite mirror already returned.
 */

export interface DailyFoodTotal {
  date: string; // YYYY-MM-DD
  kcal: number;
  proteinG: number;
}

export interface ProgressDay {
  date: string;
  kcal: number;
  proteinG: number;
  /** False for a day with nothing logged - the series fills every calendar day in the window so a
   * gap renders as a visible gap, never silently dropped or interpolated ("empty states never
   * fabricate data"). */
  hasData: boolean;
}

function dateNDaysBefore(endDate: string, n: number): string {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return new Date(end.getTime() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Builds a fixed-length chronological (oldest -> newest, inclusive of endDate) series of `days`
 * calendar days. A day with no matching total becomes a zero/`hasData: false` entry rather than
 * being omitted or interpolated from neighbouring days.
 */
export function buildDailyCalorieSeries(
  totals: readonly DailyFoodTotal[],
  days: number,
  endDate: string,
): ProgressDay[] {
  const byDate = new Map(totals.map((total) => [total.date, total]));
  const series: ProgressDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateNDaysBefore(endDate, i);
    const total = byDate.get(date);
    series.push({ date, kcal: total?.kcal ?? 0, proteinG: total?.proteinG ?? 0, hasData: Boolean(total) });
  }
  return series;
}

/**
 * Average protein across days that actually have a logged entry. Days with nothing logged are
 * excluded rather than counted as zero - a day simply not logged shouldn't drag the average down
 * and understate adherence on the days the account did log. Returns 0 when nothing in the window
 * has any data.
 */
export function averageLoggedProteinG(series: readonly ProgressDay[]): number {
  const logged = series.filter((day) => day.hasData);
  if (logged.length === 0) {
    return 0;
  }
  return Math.round(logged.reduce((sum, day) => sum + day.proteinG, 0) / logged.length);
}

/** Same for calories, used for the trend's own "avg" summary line. */
export function averageLoggedKcal(series: readonly ProgressDay[]): number {
  const logged = series.filter((day) => day.hasData);
  if (logged.length === 0) {
    return 0;
  }
  return Math.round(logged.reduce((sum, day) => sum + day.kcal, 0) / logged.length);
}

export interface WorkoutConsistencyDay {
  date: string;
  worked: boolean;
}

/**
 * Same fixed-length-series-with-gaps shape as buildDailyCalorieSeries, for the workout-days
 * consistency grid. `sessionDays` only needs to be "distinct calendar days with >=1 session"
 * (workout-repo's listSessionDaysBetween) - this never needs the sessions themselves.
 */
export function buildWorkoutConsistency(
  sessionDays: readonly string[],
  days: number,
  endDate: string,
): WorkoutConsistencyDay[] {
  const worked = new Set(sessionDays);
  const out: WorkoutConsistencyDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dateNDaysBefore(endDate, i);
    out.push({ date, worked: worked.has(date) });
  }
  return out;
}

/** Count of days worked within the series - the grid's "X of N days" summary line. */
export function countWorkoutDays(consistency: readonly WorkoutConsistencyDay[]): number {
  return consistency.filter((day) => day.worked).length;
}
