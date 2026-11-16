import { describe, expect, it } from "vitest";
import { nextProgramDayId } from "./programs";

describe("nextProgramDayId", () => {
  it("returns null when the program has no days", () => {
    expect(nextProgramDayId([], null)).toBeNull();
  });

  it("starts at the first day when nothing has been trained yet", () => {
    expect(nextProgramDayId(["day-a", "day-b"], null)).toBe("day-a");
  });

  it("advances to the next day in order", () => {
    expect(nextProgramDayId(["day-a", "day-b", "day-c"], "day-a")).toBe("day-b");
  });

  it("wraps back to the first day after the last", () => {
    expect(nextProgramDayId(["day-a", "day-b", "day-c"], "day-c")).toBe("day-a");
  });

  it("falls back to the first day when the last-used id isn't recognized", () => {
    expect(nextProgramDayId(["day-a", "day-b"], "some-other-program's-day")).toBe("day-a");
  });

  it("cycles correctly for a single-day program (always the same day)", () => {
    expect(nextProgramDayId(["only-day"], "only-day")).toBe("only-day");
  });
});
