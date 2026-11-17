import type { SqlDb } from "./sql-db";

// Shared kv keys that cross screen boundaries (one screen writes, another reads) live here rather
// than as a screen-local constant, unlike e.g. HomeScreen's own CACHED_GOAL_KEY which only that
// screen ever touches. ProgramsScreen writes these when the user follows a program;
// WorkoutSessionScreen reads them to determine "today's day" - PRD section 5.4.
export const FOLLOWED_PROGRAM_ID_KEY = "followed_program_id";
export const FOLLOWED_PROGRAM_KEY = "followed_program";

// GuestLoadingScreen/HomeScreen write these; TabScreens.tsx's MeTabScreen also reads them (the
// same offline-fallback cache, not a new one) - moved here once a second screen needed them.
export const CACHED_PROFILE_KEY = "cached_profile";
export const CACHED_GOAL_KEY = "cached_goal";

// RemindersScreen writes this; reminders.ts reads it to reschedule on app start (App.tsx) and
// TabScreens.tsx's MeTabScreen reads it to show each reminder's current enabled/time state.
export const REMINDER_SETTINGS_KEY = "reminder_settings";

// HealthConnectScreen writes this (per-data-type opt-in: steps/exercise/weight reads, workout
// write); HomeScreen reads it to decide whether to show the "Today's activity" card, and
// WorkoutSessionScreen reads it to decide whether to write an ended session to Health Connect.
export const HC_SETTINGS_KEY = "health_connect_settings";

export async function getKv(db: SqlDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setKv(db: SqlDb, key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
