import * as Notifications from "expo-notifications";
import { getKv, REMINDER_SETTINGS_KEY, setKv } from "./kv-store";
import type { SqlDb } from "./sql-db";

/**
 * Local meal/workout/water reminders (PRD §5.6). On-device only, no server component -
 * `app.reminder` (0002_app_schema.sql) is deliberately left unused: reminders are inherently
 * per-device (notification permissions and OS scheduling are device-local), and don't have the
 * sync shape (ARCHITECTURE.md §3 / CLAUDE.md "Architecture rules") this repo's other synced
 * tables follow - there would be nothing meaningful to sync anyway.
 */

export type ReminderKind = "meal" | "workout" | "water";

export interface ReminderSetting {
  /** Stable key, also used as the scheduled notification's identifier - lets a later version add/
   * rename/remove a reminder without orphaning a previously-scheduled notification under a dead id. */
  id: string;
  kind: ReminderKind;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

/** Shown the first time RemindersScreen loads, before anything's been saved to kv - every one
 * starts disabled; turning one on is what triggers the lazy permission request below. */
export const DEFAULT_REMINDERS: ReminderSetting[] = [
  { id: "breakfast", kind: "meal", label: "Breakfast", hour: 9, minute: 0, enabled: false },
  { id: "lunch", kind: "meal", label: "Lunch", hour: 13, minute: 30, enabled: false },
  { id: "dinner", kind: "meal", label: "Dinner", hour: 20, minute: 30, enabled: false },
  { id: "workout", kind: "workout", label: "Workout", hour: 18, minute: 0, enabled: false },
];

export function isValidTimeOfDay(hour: number, minute: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59;
}

function isReminderKind(value: unknown): value is ReminderKind {
  return value === "meal" || value === "workout" || value === "water";
}

/** Parses settings persisted in kv, falling back to DEFAULT_REMINDERS for anything missing,
 * malformed, or empty - a corrupt stored value (or a future schema change) degrades to defaults
 * instead of crashing the Me tab or silently scheduling nothing. */
export function parseReminderSettings(json: string | null): ReminderSetting[] {
  if (!json) return DEFAULT_REMINDERS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return DEFAULT_REMINDERS;
  }
  if (!Array.isArray(parsed)) return DEFAULT_REMINDERS;

  const valid = parsed.filter((row): row is ReminderSetting => {
    return (
      typeof row === "object" &&
      row !== null &&
      typeof (row as ReminderSetting).id === "string" &&
      isReminderKind((row as ReminderSetting).kind) &&
      typeof (row as ReminderSetting).label === "string" &&
      isValidTimeOfDay((row as ReminderSetting).hour, (row as ReminderSetting).minute) &&
      typeof (row as ReminderSetting).enabled === "boolean"
    );
  });
  return valid.length > 0 ? valid : DEFAULT_REMINDERS;
}

export async function loadReminderSettings(db: SqlDb): Promise<ReminderSetting[]> {
  return parseReminderSettings(await getKv(db, REMINDER_SETTINGS_KEY));
}

/** Persists the settings, then immediately reschedules - the two always happen together so kv and
 * the OS's scheduled notifications never drift apart. */
export async function saveReminderSettings(db: SqlDb, settings: ReminderSetting[]): Promise<void> {
  await setKv(db, REMINDER_SETTINGS_KEY, JSON.stringify(settings));
  await applyReminderSchedule(settings);
}

const NOTIFICATION_BODY: Record<ReminderKind, string> = {
  meal: "Don't forget to log your meal.",
  workout: "Time to log today's workout.",
  water: "Remember to drink some water.",
};

/** Cancels every notification this app has scheduled, then reschedules one daily trigger per
 * enabled reminder. Cancel-then-reschedule-all (rather than diffing) stays correct even if a
 * reminder was renamed/removed/retimed since the last schedule, at the cost of a full
 * cancel+reschedule on every settings change - reminders change rarely enough that this isn't a
 * real cost. */
export async function applyReminderSchedule(settings: ReminderSetting[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const reminder of settings) {
    if (!reminder.enabled) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.label, body: NOTIFICATION_BODY[reminder.kind] },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
  }
}

/** Requests OS notification permission if it isn't already granted - called lazily, the first
 * time the user turns a reminder on (RemindersScreen), not at app start, matching the
 * ask-only-when-needed posture the onboarding diet/health-data consent step already uses.
 * Returns whether the app can actually schedule reminders now. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
