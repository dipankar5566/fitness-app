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
// HomeScreen writes this (an ISO timestamp) right after it actually reads any enabled Health
// Connect data type; HealthConnectScreen reads it back to show "last read" - a settings-screen
// visit alone never updates it, only a real read does.
export const HC_LAST_READ_KEY = "health_connect_last_read";
// Badge ids already shown as a "new achievement" banner on this device (achievements-repo.ts).
// Per-device UI state, so kv rather than a synced table - badges themselves are derived, not stored.
export const ACHIEVEMENTS_SEEN_KEY = "achievements_seen";

// ThemeProvider.tsx writes this (one of "system"/"light"/"dark") whenever the user picks a theme
// from the Me tab; it reads it back once on mount so the choice survives a restart. Per-device,
// like the reminder/Health-Connect settings above - no reason to sync a display preference.
export const THEME_PREFERENCE_KEY = "theme_preference";

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
