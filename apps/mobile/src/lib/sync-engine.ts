import { trackEvent } from "./analytics.js";
import { isNetworkError, pullSync, pushSync } from "./api.js";
import {
  applyRemoteCustomFoods,
  applyRemoteIngredients,
  getDirtyCustomFoods,
  getDirtyIngredients,
  markCustomFoodClean,
  markIngredientClean,
  type LocalCustomFood,
  type LocalCustomFoodIngredient,
} from "./custom-food-repo.js";
import { applyRemote, getDirty, markClean, type RemoteFoodLogRow } from "./food-log-repo.js";
import { getKv, setKv } from "./kv-store.js";
import type { SqlDb } from "./sql-db.js";

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

  if (dirtyFoodLog.length === 0 && dirtyCustomFoods.length === 0 && dirtyIngredients.length === 0) {
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
}

async function pullChanges(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  const since = await getKv(db, SYNC_TOKEN_KEY);
  const response = await pullSync(apiUrl, accessToken, since);

  const foodLogRows: RemoteFoodLogRow[] = [];
  const customFoodRows: LocalCustomFood[] = [];
  const ingredientRows: LocalCustomFoodIngredient[] = [];

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
  await setKv(db, SYNC_TOKEN_KEY, response.nextSyncToken);
}
