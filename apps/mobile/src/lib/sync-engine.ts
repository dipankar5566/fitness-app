import { trackEvent } from "./analytics";
import { isNetworkError, pullSync, pushSync } from "./api";
import {
  applyRemoteCustomFoods,
  applyRemoteIngredients,
  getDirtyCustomFoods,
  getDirtyIngredients,
  markCustomFoodClean,
  markIngredientClean,
  type LocalCustomFood,
  type LocalCustomFoodIngredient,
} from "./custom-food-repo";
import { applyRemote, getDirty, markClean, type RemoteFoodLogRow } from "./food-log-repo";
import { getKv, setKv } from "./kv-store";
import type { SqlDb } from "./sql-db";
import {
  applyRemoteSessions,
  applyRemoteSets,
  getDirtySessions,
  getDirtySets,
  markSessionClean,
  markSetClean,
  type RemoteWorkoutSession,
  type RemoteWorkoutSet,
} from "./workout-repo";

const SYNC_TOKEN_KEY = "sync_token";

let inFlight: Promise<void> | null = null;

/**
 * Pushes dirty food_log rows, then pulls everything since the last sync token (ARCHITECTURE.md §3).
 * A module-level guard collapses overlapping calls (app start, after a write, foreground) into one
 * run. Network failures are swallowed - rows just stay dirty and go out next time; anything else
 * (a real server error) is reported and rethrown so callers can decide whether to surface it.
 */
export function syncNow(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  if (!inFlight) {
    inFlight = run(db, apiUrl, accessToken).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function run(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  try {
    await pushDirty(db, apiUrl, accessToken);
    await pullChanges(db, apiUrl, accessToken);
  } catch (error) {
    if (isNetworkError(error)) {
      trackEvent("sync_offline");
      return;
    }
    trackEvent("sync_failed");
    throw error;
  }
}

async function pushDirty(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  const dirtyFoodLog = await getDirty(db);
  const dirtyCustomFoods = await getDirtyCustomFoods(db);
  const dirtyIngredients = await getDirtyIngredients(db);
  const dirtySessions = await getDirtySessions(db);
  const dirtySets = await getDirtySets(db);

  if (
    dirtyFoodLog.length === 0 &&
    dirtyCustomFoods.length === 0 &&
    dirtyIngredients.length === 0 &&
    dirtySessions.length === 0 &&
    dirtySets.length === 0
  ) {
    return;
  }

  const syncToken = await getKv(db, SYNC_TOKEN_KEY);
  const response = await pushSync(apiUrl, accessToken, {
    syncToken,
    rows: [
      ...dirtyFoodLog.map((row) => ({
        table: "food_log" as const,
        op: row.isDeleted ? ("delete" as const) : ("upsert" as const),
        row: {
          id: row.id, accountId: row.accountId, isDeleted: row.isDeleted, updatedAt: row.updatedAt,
          foodSource: row.foodSource, foodRef: row.foodRef, quantity: row.quantity, unit: row.unit,
          mealType: row.mealType, loggedAt: row.loggedAt, source: row.source, isEstimate: row.isEstimate,
        },
      })),
      ...dirtyCustomFoods.map((row) => ({
        table: "custom_food" as const,
        op: row.isDeleted ? ("delete" as const) : ("upsert" as const),
        row: { id: row.id, accountId: row.accountId, isDeleted: row.isDeleted, updatedAt: row.updatedAt, name: row.name },
      })),
      ...dirtyIngredients.map((row) => ({
        table: "custom_food_ingredient" as const,
        op: row.isDeleted ? ("delete" as const) : ("upsert" as const),
        row: {
          id: row.id, accountId: row.accountId, isDeleted: row.isDeleted, updatedAt: row.updatedAt,
          customFoodId: row.customFoodId, foodSource: row.foodSource, foodRef: row.foodRef, quantityG: row.quantityG,
        },
      })),
      // Sessions listed before sets - a brand-new session's sets have a session_id FK to it, and
      // push() applies rows in array order within one transaction (same ordering custom_food/
      // custom_food_ingredient already rely on).
      ...dirtySessions.map((row) => ({
        table: "workout_session" as const,
        op: row.isDeleted ? ("delete" as const) : ("upsert" as const),
        row: {
          id: row.id, accountId: row.accountId, isDeleted: row.isDeleted, updatedAt: row.updatedAt,
          programDayId: row.programDayId ?? undefined, startedAt: row.startedAt, endedAt: row.endedAt ?? undefined,
        },
      })),
      ...dirtySets.map((row) => ({
        table: "workout_set" as const,
        op: row.isDeleted ? ("delete" as const) : ("upsert" as const),
        row: {
          id: row.id, accountId: row.accountId, isDeleted: row.isDeleted, updatedAt: row.updatedAt,
          sessionId: row.sessionId, exerciseId: row.exerciseId, setNo: row.setNo, reps: row.reps,
          weightKg: row.weightKg, rpe: row.rpe ?? undefined, isWarmup: row.isWarmup,
        },
      })),
    ],
  });

  // Rejected rows (stale/not_owner/invalid) are left dirty on purpose - v1 retries them forever
  // rather than silently dropping a user's edit; a future pass can surface a conflict UI.
  const appliedIds = new Set(response.applied);
  for (const row of dirtyFoodLog) {
    if (appliedIds.has(row.id)) {
      await markClean(db, row.id, row.updatedAt);
    }
  }
  for (const row of dirtyCustomFoods) {
    if (appliedIds.has(row.id)) {
      await markCustomFoodClean(db, row.id, row.updatedAt);
    }
  }
  for (const row of dirtyIngredients) {
    if (appliedIds.has(row.id)) {
      await markIngredientClean(db, row.id, row.updatedAt);
    }
  }
  for (const row of dirtySessions) {
    if (appliedIds.has(row.id)) {
      await markSessionClean(db, row.id, row.updatedAt);
    }
  }
  for (const row of dirtySets) {
    if (appliedIds.has(row.id)) {
      await markSetClean(db, row.id, row.updatedAt);
    }
  }
}

async function pullChanges(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  const since = await getKv(db, SYNC_TOKEN_KEY);
  const response = await pullSync(apiUrl, accessToken, since);

  const foodLogRows: RemoteFoodLogRow[] = [];
  const customFoodRows: LocalCustomFood[] = [];
  const ingredientRows: LocalCustomFoodIngredient[] = [];
  const sessionRows: RemoteWorkoutSession[] = [];
  const setRows: RemoteWorkoutSet[] = [];

  for (const change of response.changes) {
    const row = change.row as Record<string, unknown>;
    const isDeleted = change.op === "delete" || Boolean(row.isDeleted);

    if (change.table === "food_log") {
      foodLogRows.push({
        id: row.id as string,
        accountId: row.accountId as string,
        foodSource: row.foodSource as string,
        foodRef: row.foodRef as string,
        quantity: row.quantity as number,
        unit: row.unit as string,
        mealType: row.mealType as string,
        loggedAt: row.loggedAt as string,
        source: row.source as string,
        isEstimate: Boolean(row.isEstimate),
        isDeleted,
        updatedAt: row.updatedAt as string,
        macros: (row.macros as RemoteFoodLogRow["macros"]) ?? null,
      });
    } else if (change.table === "custom_food") {
      customFoodRows.push({
        id: row.id as string,
        accountId: row.accountId as string,
        name: row.name as string,
        isDeleted,
        updatedAt: row.updatedAt as string,
      });
    } else if (change.table === "custom_food_ingredient") {
      ingredientRows.push({
        id: row.id as string,
        accountId: row.accountId as string,
        customFoodId: row.customFoodId as string,
        foodSource: row.foodSource as string,
        foodRef: row.foodRef as string,
        quantityG: row.quantityG as number,
        isDeleted,
        updatedAt: row.updatedAt as string,
      });
    } else if (change.table === "workout_session") {
      sessionRows.push({
        id: row.id as string,
        accountId: row.accountId as string,
        programDayId: (row.programDayId as string | undefined) ?? null,
        startedAt: row.startedAt as string,
        endedAt: (row.endedAt as string | undefined) ?? null,
        isDeleted,
        updatedAt: row.updatedAt as string,
      });
    } else if (change.table === "workout_set") {
      setRows.push({
        id: row.id as string,
        accountId: row.accountId as string,
        sessionId: row.sessionId as string,
        exerciseId: row.exerciseId as string,
        setNo: row.setNo as number,
        reps: row.reps as number,
        weightKg: row.weightKg as number,
        rpe: (row.rpe as number | undefined) ?? null,
        isWarmup: Boolean(row.isWarmup),
        isDeleted,
        updatedAt: row.updatedAt as string,
      });
    }
  }

  if (foodLogRows.length > 0) {
    await applyRemote(db, foodLogRows);
  }
  if (customFoodRows.length > 0) {
    await applyRemoteCustomFoods(db, customFoodRows);
  }
  if (ingredientRows.length > 0) {
    await applyRemoteIngredients(db, ingredientRows);
  }
  if (sessionRows.length > 0) {
    await applyRemoteSessions(db, sessionRows);
  }
  if (setRows.length > 0) {
    await applyRemoteSets(db, setRows);
  }
  await setKv(db, SYNC_TOKEN_KEY, response.nextSyncToken);
}
