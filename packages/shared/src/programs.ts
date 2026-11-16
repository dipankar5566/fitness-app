/**
 * Program day sequencing for the "follow a program" flow (PRD §5.4). There's no server-side
 * "account follows program X" relationship (ARCHITECTURE.md §2 lists no such table) - following a
 * program is purely local state (the mobile app caches which program was picked), and "today's
 * session" just needs to know which day comes next. Pure and deterministic: fed by the day ids the
 * caller already has and whichever one was used last (derived from local workout_session history).
 */

/**
 * The next day to train, cycling through `dayIds` in order. `lastUsedDayId` is the program_day_id
 * of the account's most recent session for this program, or null if they've never started one.
 * An unrecognized `lastUsedDayId` (e.g. the program's days changed since) falls back to day 0
 * rather than throwing - restarting the cycle is harmless, unlike guessing wrong.
 */
export function nextProgramDayId(dayIds: string[], lastUsedDayId: string | null): string | null {
  if (dayIds.length === 0) {
    return null;
  }
  if (lastUsedDayId === null) {
    return dayIds[0];
  }
  const index = dayIds.indexOf(lastUsedDayId);
  if (index === -1) {
    return dayIds[0];
  }
  return dayIds[(index + 1) % dayIds.length];
}
