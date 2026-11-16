import { trackEvent } from "./analytics.js";
import { isNetworkError, pullSync, pushSync } from "./api.js";
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
  const dirty = await getDirty(db);
  if (dirty.length === 0) {
    return;
  }

  const syncToken = await getKv(db, SYNC_TOKEN_KEY);
  const response = await pushSync(apiUrl, accessToken, {
    syncToken,
    rows: dirty.map((row) => ({
      table: "food_log",
      op: row.isDeleted ? "delete" : "upsert",
      row: {
        id: row.id,
        accountId: row.accountId,
        isDeleted: row.isDeleted,
        updatedAt: row.updatedAt,
        foodSource: row.foodSource,
        foodRef: row.foodRef,
        quantity: row.quantity,
        unit: row.unit,
        mealType: row.mealType,
        loggedAt: row.loggedAt,
        source: row.source,
        isEstimate: row.isEstimate,
      },
    })),
  });

  // Rejected rows (stale/not_owner/invalid) are left dirty on purpose - v1 retries them forever
  // rather than silently dropping a user's edit; a future pass can surface a conflict UI.
  for (const id of response.applied) {
    const row = dirty.find((dirtyRow) => dirtyRow.id === id);
    if (row) {
      await markClean(db, row.id, row.updatedAt);
    }
  }
}

async function pullChanges(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  const since = await getKv(db, SYNC_TOKEN_KEY);
  const response = await pullSync(apiUrl, accessToken, since);

  const remoteRows: RemoteFoodLogRow[] = response.changes
    .filter((change) => change.table === "food_log")
    .map((change) => {
      const row = change.row as Record<string, unknown>;
      return {
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
        isDeleted: change.op === "delete" || Boolean(row.isDeleted),
        updatedAt: row.updatedAt as string,
        macros: (row.macros as RemoteFoodLogRow["macros"]) ?? null,
      };
    });

  if (remoteRows.length > 0) {
    await applyRemote(db, remoteRows);
  }
  await setKv(db, SYNC_TOKEN_KEY, response.nextSyncToken);
}
