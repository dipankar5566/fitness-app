/**
 * Logging-streak computation — PRD §5.6 ("logging streak (forgiving: 1 freeze/week)"). Pure,
 * deterministic, fed by whatever logged dates the caller already has (apps/mobile's local SQLite
 * mirror of food_log) — same "already have it locally, no new endpoint" pattern as
 * workout-prs.ts's PR tracking — so this needs no I/O and nothing is stored or synced
 * server-side. `app.streak` (0002_app_schema.sql) is deliberately left unused: a streak is fully
 * derivable from food_log's existing dates, and doesn't have the four-column syncable shape
 * (ARCHITECTURE.md §3 / CLAUDE.md "Architecture rules") this repo's other synced tables follow.
 */

export interface LoggingStreak {
  /** Consecutive logged days up to (and including, if logged) today - see loggedToday. */
  length: number;
  loggedToday: boolean;
  /** Whether the single weekly freeze (a bridged missed day) has already been used in the ISO
   * week containing `today` - lets the UI say "freeze used this week" vs. still available. */
  freezeUsedThisWeek: boolean;
}

/** YYYY-MM-DD arithmetic done in UTC so it's independent of the caller's local timezone - the
 * caller passes local calendar dates (the same convention as food-log-repo.ts's
 * substr(logged_at, 1, 10)), not real UTC timestamps. */
function addDays(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** ISO 8601 week identifier ("2026-W47") - weeks run Monday to Sunday, keyed by the year of the
 * week's Thursday (the standard ISO rule for which year a year-boundary week belongs to). */
function isoWeekKey(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay() || 7; // Sunday (0) -> 7, so Monday=1 .. Sunday=7
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek); // shift to this week's Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Walks backward day by day from today (or yesterday, if today isn't logged yet - an unlogged
 * today doesn't break an otherwise-live streak) counting consecutive logged days. A single
 * missed day is bridged ("freeze") at most once per ISO week; a second missed day in the same
 * week, or two consecutive missed days outright, ends the streak - the two-consecutive-day rule
 * is checked first, so a freeze can never bridge two days in a row even in an otherwise-unused
 * week.
 */
export function computeLoggingStreak(loggedDates: readonly string[], today: string): LoggingStreak {
  const loggedSet = new Set(loggedDates);
  const loggedToday = loggedSet.has(today);
  const currentWeekKey = isoWeekKey(today);

  let cursor = loggedToday ? today : addDays(today, -1);
  let length = 0;
  let consecutiveMisses = 0;
  let freezeUsedThisWeek = false;
  const freezeUsedByWeek = new Set<string>();

  // A defensive cap (~10 years), not something real input should ever reach: two consecutive
  // misses always ends the walk, so this only guards against malformed input.
  for (let i = 0; i < 3660; i++) {
    if (loggedSet.has(cursor)) {
      length++;
      consecutiveMisses = 0;
      cursor = addDays(cursor, -1);
      continue;
    }

    consecutiveMisses++;
    if (consecutiveMisses >= 2) {
      break;
    }
    const weekKey = isoWeekKey(cursor);
    if (freezeUsedByWeek.has(weekKey)) {
      break;
    }
    freezeUsedByWeek.add(weekKey);
    if (weekKey === currentWeekKey) {
      freezeUsedThisWeek = true;
    }
    cursor = addDays(cursor, -1);
  }

  return { length, loggedToday, freezeUsedThisWeek };
}
