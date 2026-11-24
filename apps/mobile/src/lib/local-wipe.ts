import type { SqlDb } from "./sql-db";
import { REMINDER_SETTINGS_KEY, THEME_PREFERENCE_KEY } from "./kv-store";

// Every table db-schema.ts creates that holds account-specific or account-derived data. A table
// added later needs a line here too, same as AccountMergeService's server-side table list - there's
// no generic/reflective way to tell "this device's account data" apart from device-level state.
const ACCOUNT_SCOPED_TABLES = [
  "food_log",
  "food_cache",
  "custom_food",
  "custom_food_ingredient",
  "workout_session",
  "workout_set",
  "body_metric",
  "water_log",
  "fasting_log",
] as const;

// kv keys kept across a wipe: per-device preferences, not account data (CLAUDE.md: app.reminder/
// the theme choice are deliberately local-only and never synced). Everything else in kv - the sync
// cursor, cached profile/goal, followed program, achievements-seen, Health Connect settings - is
// account-scoped and must go, so this is a keep-list rather than an enumerated delete-list: a kv key
// added later for account data is wiped by default instead of silently surviving a sign-out.
const KV_KEYS_TO_KEEP = [THEME_PREFERENCE_KEY, REMINDER_SETTINGS_KEY];

/**
 * Wipes every local trace of the current account - used both when signing out (so the next guest
 * starts clean) and when a guest's device data is about to be replaced by a pulled account during a
 * merge sign-in (local-wipe.ts's docstring in the plan: "wipeAccountData", called before syncNow
 * pulls the real account's data down). Device-level preferences (theme, reminders) survive.
 */
export async function wipeAccountData(db: SqlDb): Promise<void> {
  for (const table of ACCOUNT_SCOPED_TABLES) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
  const placeholders = KV_KEYS_TO_KEEP.map(() => "?").join(", ");
  await db.runAsync(`DELETE FROM kv WHERE key NOT IN (${placeholders})`, [...KV_KEYS_TO_KEEP]);
}
