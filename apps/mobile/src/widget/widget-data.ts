import { kcalRemaining, sumKcal, waterGoalMl } from "@fitness-app/shared";
import { getLatest as getLatestBodyMetric } from "../lib/body-metric-repo";
import { listByLocalDay } from "../lib/food-log-repo";
import { CACHED_GOAL_KEY, getKv } from "../lib/kv-store";
import type { SqlDb } from "../lib/sql-db";
import { totalMlBetween } from "../lib/water-repo";

/** What the home-screen widget shows. `targetKcal` is null before onboarding (no cached goal). */
export interface WidgetSnapshot {
  eatenKcal: number;
  targetKcal: number | null;
  kcalLeft: number | null;
  waterMl: number;
  waterGoalMl: number;
}

/** Same UTC-day convention as HomeScreen's todayDate()/todayBoundsIso(), so the widget and the
 * Today screen always agree on which day it is. */
export function dayBounds(now: Date): { date: string; startIso: string; endIso: string } {
  const date = now.toISOString().slice(0, 10);
  const startIso = `${date}T00:00:00.000Z`;
  const endIso = new Date(Date.parse(startIso) + 24 * 60 * 60 * 1000).toISOString();
  return { date, startIso, endIso };
}

/**
 * Reads today's numbers for the widget straight from the local SQLite mirror - the widget's
 * headless task runs without the app UI and often offline, so nothing here touches the network.
 * The kcal target comes from the goal HomeScreen caches in kv (CACHED_GOAL_KEY), the same offline
 * fallback the Today screen itself uses.
 */
export async function loadWidgetSnapshot(db: SqlDb, accountId: string, now: Date = new Date()): Promise<WidgetSnapshot> {
  const { date, startIso, endIso } = dayBounds(now);
  const eatenKcal = Math.round(sumKcal(await listByLocalDay(db, accountId, date)));

  let targetKcal: number | null = null;
  const cachedGoal = await getKv(db, CACHED_GOAL_KEY);
  if (cachedGoal) {
    try {
      const parsed = JSON.parse(cachedGoal) as { target_kcal?: string | number } | null;
      const value = Number(parsed?.target_kcal);
      targetKcal = Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    } catch {
      targetKcal = null;
    }
  }

  const latestWeight = await getLatestBodyMetric(db, accountId, "weight_kg");
  return {
    eatenKcal,
    targetKcal,
    kcalLeft: targetKcal === null ? null : kcalRemaining(eatenKcal, targetKcal),
    waterMl: await totalMlBetween(db, accountId, startIso, endIso),
    waterGoalMl: waterGoalMl(latestWeight?.value ?? null),
  };
}
