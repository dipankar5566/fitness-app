import { afterEach, describe, expect, it, vi } from "vitest";

// expo-notifications can't be imported outside a React Native/Expo runtime (it pulls in `expo`'s
// own module registry) - mocked the same way analytics.test.ts mocks @sentry/react-native, so
// this file can both test the pure settings logic directly and verify the thin scheduling wrapper
// calls the native API correctly, without ever loading the real native module. Unlike
// analytics.test.ts (which defers its import to runtime instead), this file imports "./reminders"
// statically, so the mock object itself must be built with vi.hoisted - plain ESM import hoisting
// would otherwise evaluate "./reminders" (and the vi.mock factory) before a plain top-level const
// here had run, hitting a "before initialization" TDZ error.
const notificationsMock = vi.hoisted(() => ({
  cancelAllScheduledNotificationsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));
vi.mock("expo-notifications", () => notificationsMock);

import {
  applyReminderSchedule,
  DEFAULT_REMINDERS,
  ensureNotificationPermission,
  isValidTimeOfDay,
  parseReminderSettings,
  type ReminderSetting,
} from "./reminders";

describe("isValidTimeOfDay", () => {
  it("accepts every valid hour/minute combination", () => {
    expect(isValidTimeOfDay(0, 0)).toBe(true);
    expect(isValidTimeOfDay(23, 59)).toBe(true);
    expect(isValidTimeOfDay(9, 30)).toBe(true);
  });

  it("rejects out-of-range or non-integer values", () => {
    expect(isValidTimeOfDay(24, 0)).toBe(false);
    expect(isValidTimeOfDay(-1, 0)).toBe(false);
    expect(isValidTimeOfDay(9, 60)).toBe(false);
    expect(isValidTimeOfDay(9.5, 0)).toBe(false);
  });
});

describe("parseReminderSettings", () => {
  it("falls back to DEFAULT_REMINDERS for null (nothing saved yet)", () => {
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDERS);
  });

  it("falls back to DEFAULT_REMINDERS for malformed JSON", () => {
    expect(parseReminderSettings("{not valid json")).toEqual(DEFAULT_REMINDERS);
  });

  it("falls back to DEFAULT_REMINDERS when the JSON isn't an array", () => {
    expect(parseReminderSettings(JSON.stringify({ not: "an array" }))).toEqual(DEFAULT_REMINDERS);
  });

  it("round-trips a valid saved settings array", () => {
    const settings: ReminderSetting[] = [
      { id: "breakfast", kind: "meal", label: "Breakfast", hour: 7, minute: 15, enabled: true },
    ];
    expect(parseReminderSettings(JSON.stringify(settings))).toEqual(settings);
  });

  it("drops individually malformed rows but keeps the valid ones", () => {
    const valid: ReminderSetting = { id: "workout", kind: "workout", label: "Workout", hour: 18, minute: 0, enabled: true };
    const stored = [valid, { id: "bad", kind: "not-a-kind", label: "x", hour: 99, minute: 0, enabled: true }];
    expect(parseReminderSettings(JSON.stringify(stored))).toEqual([valid]);
  });

  it("falls back to DEFAULT_REMINDERS if every row is malformed", () => {
    const stored = [{ id: "bad", kind: "not-a-kind", label: "x", hour: 99, minute: 0, enabled: true }];
    expect(parseReminderSettings(JSON.stringify(stored))).toEqual(DEFAULT_REMINDERS);
  });
});

describe("applyReminderSchedule", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cancels everything, then schedules only the enabled reminders with a daily trigger", async () => {
    const settings: ReminderSetting[] = [
      { id: "breakfast", kind: "meal", label: "Breakfast", hour: 9, minute: 0, enabled: true },
      { id: "lunch", kind: "meal", label: "Lunch", hour: 13, minute: 30, enabled: false },
    ];

    await applyReminderSchedule(settings);

    expect(notificationsMock.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: "breakfast",
      content: { title: "Breakfast", body: expect.any(String) },
      trigger: { type: "daily", hour: 9, minute: 0 },
    });
  });

  it("schedules nothing when every reminder is disabled", async () => {
    await applyReminderSchedule([{ id: "breakfast", kind: "meal", label: "Breakfast", hour: 9, minute: 0, enabled: false }]);

    expect(notificationsMock.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("ensureNotificationPermission", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns true without prompting if already granted", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({ granted: true });

    const result = await ensureNotificationPermission();

    expect(result).toBe(true);
    expect(notificationsMock.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("prompts and returns the result if not already granted", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({ granted: false });
    notificationsMock.requestPermissionsAsync.mockResolvedValue({ granted: true });

    const result = await ensureNotificationPermission();

    expect(result).toBe(true);
    expect(notificationsMock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("returns false if the user denies the prompt", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValue({ granted: false });
    notificationsMock.requestPermissionsAsync.mockResolvedValue({ granted: false });

    expect(await ensureNotificationPermission()).toBe(false);
  });
});
