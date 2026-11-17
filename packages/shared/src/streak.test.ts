import { describe, expect, it } from "vitest";
import { computeLoggingStreak } from "./streak";

// Fixed anchor dates (not "new Date()") so these tests are deterministic regardless of when they
// run. 2026-11-17 is a Tuesday in ISO week 2026-W47 (Mon 11-16 .. Sun 11-22); 2026-W46 runs
// Mon 11-09 .. Sun 11-15, and 2026-W45 runs Mon 11-02 .. Sun 11-08.
const TODAY = "2026-11-17";

describe("computeLoggingStreak", () => {
  it("increments day over day for an unbroken run including today", () => {
    const result = computeLoggingStreak(["2026-11-17", "2026-11-16", "2026-11-15"], TODAY);
    expect(result).toEqual({ length: 3, loggedToday: true, freezeUsedThisWeek: false });
  });

  it("bridges a single missed day with the week's one freeze, continuing the streak past it", () => {
    // 2026-11-15 (Sun, W46) is missing; everything else from 17 back to 13 is logged.
    const loggedDates = ["2026-11-17", "2026-11-16", "2026-11-14", "2026-11-13"];
    const result = computeLoggingStreak(loggedDates, TODAY);
    expect(result.length).toBe(4);
    expect(result.loggedToday).toBe(true);
    // The freeze was spent in W46, not in the current week (W47).
    expect(result.freezeUsedThisWeek).toBe(false);
  });

  it("a second missed day in the same week resets the streak at that second gap", () => {
    // Both 2026-11-15 and 2026-11-13 (same W46) are missing; 2026-11-12 is logged but must be
    // excluded, since the streak already ended at the second same-week gap before reaching it.
    const loggedDates = ["2026-11-17", "2026-11-16", "2026-11-14", "2026-11-12"];
    const result = computeLoggingStreak(loggedDates, TODAY);
    expect(result.length).toBe(3); // 17, 16, 14 only - 12 is not reached
  });

  it("a gap in a later week is bridged again - the per-week freeze budget is independent", () => {
    // One missed day in W46 (11-15) and one missed day in W45 (11-08), each the week's only gap.
    const loggedDates = [
      "2026-11-17", "2026-11-16", // W47
      "2026-11-14", "2026-11-13", "2026-11-12", "2026-11-11", "2026-11-10", "2026-11-09", // W46 minus 15
      "2026-11-07", "2026-11-06", "2026-11-05", "2026-11-04", // W45 minus 08
    ];
    const result = computeLoggingStreak(loggedDates, TODAY);
    expect(result.length).toBe(loggedDates.length); // every logged day counts; both gaps bridged
  });

  it("two consecutive missed days reset the streak regardless of the weekly freeze", () => {
    // 2026-11-15 and 2026-11-14 are both missing (consecutive) - the first miss would otherwise
    // be eligible for that week's freeze, but the immediate second miss overrides it.
    const loggedDates = ["2026-11-17", "2026-11-16", "2026-11-13", "2026-11-12"];
    const result = computeLoggingStreak(loggedDates, TODAY);
    expect(result.length).toBe(2); // 17, 16 only
  });

  it("returns a zero-length streak for empty history", () => {
    // Use a Monday "today" so yesterday falls in the prior ISO week, keeping freezeUsedThisWeek
    // unambiguous (it reports the *current* week's budget, not a week that already ended).
    const result = computeLoggingStreak([], "2026-11-16");
    expect(result).toEqual({ length: 0, loggedToday: false, freezeUsedThisWeek: false });
  });

  it("an unlogged today doesn't break an otherwise-live streak", () => {
    const loggedDates = ["2026-11-16", "2026-11-15", "2026-11-14"]; // today (17) is not logged
    const result = computeLoggingStreak(loggedDates, TODAY);
    expect(result.loggedToday).toBe(false);
    expect(result.length).toBe(3);
  });
});
