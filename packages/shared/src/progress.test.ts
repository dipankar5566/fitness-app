import { describe, expect, it } from "vitest";
import {
  averageLoggedKcal,
  averageLoggedProteinG,
  buildDailyCalorieSeries,
  buildWorkoutConsistency,
  countWorkoutDays,
} from "./progress";

const END = "2026-11-17";

describe("buildDailyCalorieSeries", () => {
  it("returns exactly `days` entries, chronological, ending at endDate", () => {
    const series = buildDailyCalorieSeries([], 7, END);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe("2026-11-11");
    expect(series[6].date).toBe(END);
  });

  it("fills a day with a matching total and marks it hasData", () => {
    const series = buildDailyCalorieSeries([{ date: "2026-11-16", kcal: 1800, proteinG: 120 }], 7, END);
    const day = series.find((d) => d.date === "2026-11-16");
    expect(day).toEqual({ date: "2026-11-16", kcal: 1800, proteinG: 120, hasData: true });
  });

  it("fills a day with no matching total as zero/hasData:false, never interpolated", () => {
    const series = buildDailyCalorieSeries([{ date: "2026-11-16", kcal: 1800, proteinG: 120 }], 7, END);
    const gap = series.find((d) => d.date === "2026-11-15");
    expect(gap).toEqual({ date: "2026-11-15", kcal: 0, proteinG: 0, hasData: false });
  });

  it("a totals entry outside the requested window doesn't appear in the series", () => {
    const series = buildDailyCalorieSeries([{ date: "2025-01-01", kcal: 1800, proteinG: 120 }], 7, END);
    expect(series.every((d) => d.hasData === false)).toBe(true);
  });
});

describe("averageLoggedProteinG / averageLoggedKcal", () => {
  it("averages only across days with data, excluding unlogged gaps from the denominator", () => {
    const series = buildDailyCalorieSeries(
      [
        { date: "2026-11-16", kcal: 2000, proteinG: 100 },
        { date: "2026-11-17", kcal: 1800, proteinG: 140 },
      ],
      7,
      END,
    );
    // (100 + 140) / 2 logged days, NOT / 7 total days in the window.
    expect(averageLoggedProteinG(series)).toBe(120);
    expect(averageLoggedKcal(series)).toBe(1900);
  });

  it("returns 0 for a window with no data at all", () => {
    const series = buildDailyCalorieSeries([], 7, END);
    expect(averageLoggedProteinG(series)).toBe(0);
    expect(averageLoggedKcal(series)).toBe(0);
  });
});

describe("buildWorkoutConsistency / countWorkoutDays", () => {
  it("marks a session day worked and leaves everything else unworked", () => {
    const consistency = buildWorkoutConsistency(["2026-11-14", "2026-11-16"], 7, END);
    expect(consistency.filter((d) => d.worked).map((d) => d.date)).toEqual(["2026-11-14", "2026-11-16"]);
  });

  it("countWorkoutDays counts exactly the worked days in the window, ignoring out-of-window ones", () => {
    const consistency = buildWorkoutConsistency(["2026-11-14", "2026-11-16", "2025-01-01"], 7, END);
    expect(countWorkoutDays(consistency)).toBe(2);
  });

  it("an empty session-days list yields a fully-unworked grid of length `days`", () => {
    const consistency = buildWorkoutConsistency([], 30, END);
    expect(consistency).toHaveLength(30);
    expect(countWorkoutDays(consistency)).toBe(0);
  });
});
