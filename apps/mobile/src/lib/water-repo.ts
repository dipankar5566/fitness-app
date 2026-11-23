import type { SqlDb } from "./sql-db";

/** One "glass" - the step size of the Today water card and the widget's "+ Glass" button. */
export const GLASS_ML = 250;

export interface LocalWaterLog {
  id: string;
  accountId: string;
  amountMl: number;
  recordedAt: string;
  isDeleted: boolean;
  updatedAt: string;
}

/** A row pulled from the server via GET /sync. */
export type RemoteWaterLog = LocalWaterLog;

interface WaterLogSqlRow {
  id: string;
  account_id: string;
  amount_ml: number;
  recorded_at: string;
  is_deleted: number;
  updated_at: string;
}

function fromSqlRow(row: WaterLogSqlRow): LocalWaterLog {
  return {
    id: row.id,
    accountId: row.account_id,
    amountMl: row.amount_ml,
    recordedAt: row.recorded_at,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Local SQLite mirror of app.water_log (0009), following the same dirty-flag outbox pattern as
 * body-metric-repo.ts. One row per drink event; the Home water card adds a glass (insert) or
 * removes the most recently added one (softDeleteLatestBetween) and reads the day's total.
 */
export async function insert(db: SqlDb, row: LocalWaterLog): Promise<void> {
  await db.runAsync(
    `INSERT INTO water_log (id, account_id, amount_ml, recorded_at, is_deleted, updated_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.accountId, row.amountMl, row.recordedAt, row.isDeleted ? 1 : 0, row.updatedAt],
  );
}

/** Total ml logged in a half-open [startIso, endIso) window (e.g. the local day), ignoring
 * soft-deleted rows. The caller computes the window so day boundaries follow the device's locale. */
export async function totalMlBetween(
  db: SqlDb,
  accountId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT sum(amount_ml) AS total FROM water_log
     WHERE account_id = ? AND is_deleted = 0 AND recorded_at >= ? AND recorded_at < ?`,
    [accountId, startIso, endIso],
  );
  return row?.total ?? 0;
}

/** Soft-deletes the most recently recorded (non-deleted) glass in the window - the Home card's
 * "minus" / undo. Bumps updated_at + is_dirty so the delete syncs. Returns true if one was removed. */
export async function softDeleteLatestBetween(
  db: SqlDb,
  accountId: string,
  startIso: string,
  endIso: string,
  updatedAt: string,
): Promise<boolean> {
  const latest = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM water_log
     WHERE account_id = ? AND is_deleted = 0 AND recorded_at >= ? AND recorded_at < ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [accountId, startIso, endIso],
  );
  if (!latest) {
    return false;
  }
  await db.runAsync(
    "UPDATE water_log SET is_deleted = 1, updated_at = ?, is_dirty = 1 WHERE id = ?",
    [updatedAt, latest.id],
  );
  return true;
}

export async function getDirty(db: SqlDb): Promise<LocalWaterLog[]> {
  const rows = await db.getAllAsync<WaterLogSqlRow>("SELECT * FROM water_log WHERE is_dirty = 1");
  return rows.map(fromSqlRow);
}

export async function markClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE water_log SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

export async function applyRemote(db: SqlDb, rows: RemoteWaterLog[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM water_log WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO water_log (id, account_id, amount_ml, recorded_at, is_deleted, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, amount_ml = excluded.amount_ml,
           recorded_at = excluded.recorded_at, is_deleted = excluded.is_deleted,
           updated_at = excluded.updated_at, is_dirty = 0`,
        [row.id, row.accountId, row.amountMl, row.recordedAt, row.isDeleted ? 1 : 0, row.updatedAt],
      );
    }
  });
}
