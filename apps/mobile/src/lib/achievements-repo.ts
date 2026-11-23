import {
  completedFasts,
  computeAchievements,
  countPrImprovements,
  waterGoalMl,
  type AchievementSummary,
  type SetForPrCount,
} from "@fitness-app/shared";
import { getLatest as getLatestBodyMetric } from "./body-metric-repo";
import { listRecent as listRecentFasts } from "./fasting-repo";
import { listLoggedLocalDays } from "./food-log-repo";
import { ACHIEVEMENTS_SEEN_KEY, getKv, setKv } from "./kv-store";
import type { SqlDb } from "./sql-db";

/** Effectively "all history" - fasting_log rows are tiny, and achievements need every completed fast. */
const FASTING_HISTORY_LIMIT = 100_000;

/**
 * Gathers packages/shared's computeAchievements inputs from the local SQLite mirror - nothing is
 * fetched from the server or stored beyond the per-device "seen" set, the same derive-locally
 * approach HomeScreen already uses for the logging streak. Water-goal days are judged against the
 * *current* goal (from the latest weight) rather than a historical one per day: the goal only moves
 * with weight, and a per-day goal history isn't stored anywhere.
 */
export async function loadAchievements(db: SqlDb, accountId: string): Promise<AchievementSummary> {
  const loggedDates = await listLoggedLocalDays(db, accountId, "0000-01-01");

  const workoutRow = await db.getFirstAsync<{ n: number }>(
    `SELECT count(DISTINCT s.id) AS n FROM workout_session s
     JOIN workout_set w ON w.session_id = s.id AND w.is_deleted = 0
     WHERE s.account_id = ? AND s.is_deleted = 0`,
    [accountId],
  );

  const setRows = await db.getAllAsync<{
    exercise_id: string;
    started_at: string;
    reps: number;
    weight_kg: number;
    is_warmup: number;
  }>(
    `SELECT w.exercise_id, s.started_at, w.reps, w.weight_kg, w.is_warmup FROM workout_set w
     JOIN workout_session s ON s.id = w.session_id AND s.is_deleted = 0
     WHERE w.account_id = ? AND w.is_deleted = 0`,
    [accountId],
  );
  const sets: SetForPrCount[] = setRows.map((row) => ({
    exerciseId: row.exercise_id,
    sessionStartedAt: row.started_at,
    reps: row.reps,
    weightKg: row.weight_kg,
    isWarmup: row.is_warmup === 1,
  }));

  const latestWeight = await getLatestBodyMetric(db, accountId, "weight_kg");
  const goalMl = waterGoalMl(latestWeight?.value ?? null);
  const waterDays = await db.getAllAsync<{ total: number }>(
    `SELECT sum(amount_ml) AS total FROM water_log WHERE account_id = ? AND is_deleted = 0
     GROUP BY substr(recorded_at, 1, 10)`,
    [accountId],
  );

  const fasts = await listRecentFasts(db, accountId, FASTING_HISTORY_LIMIT);

  return computeAchievements({
    loggedDates,
    workoutCount: workoutRow?.n ?? 0,
    prImprovementCount: countPrImprovements(sets),
    waterGoalDays: waterDays.filter((day) => day.total >= goalMl).length,
    completedFastCount: completedFasts(fasts).length,
  });
}

/** Badge ids already shown to the user on this device. */
export async function getSeenBadgeIds(db: SqlDb): Promise<Set<string>> {
  const raw = await getKv(db, ACHIEVEMENTS_SEEN_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Unlocked badges not yet shown on this device - Today shows these once, then markBadgesSeen. */
export async function getNewlyUnlocked(db: SqlDb, summary: AchievementSummary): Promise<AchievementSummary["badges"]> {
  const seen = await getSeenBadgeIds(db);
  return summary.badges.filter((badge) => badge.unlocked && !seen.has(badge.id));
}

export async function markBadgesSeen(db: SqlDb, ids: readonly string[]): Promise<void> {
  const seen = await getSeenBadgeIds(db);
  for (const id of ids) seen.add(id);
  await setKv(db, ACHIEVEMENTS_SEEN_KEY, JSON.stringify([...seen]));
}
