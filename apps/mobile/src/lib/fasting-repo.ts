import type { SqlDb } from "./sql-db";

export interface LocalFastingLog {
  id: string;
  accountId: string;
  startedAt: string;
  /** null while the fast is still in progress. */
  endedAt: string | null;
  targetMinutes: number;
  isDeleted: boolean;
  updatedAt: string;
}

/** A row pulled from the server via GET /sync. */
export type RemoteFastingLog = LocalFastingLog;

interface FastingLogSqlRow {
  id: string;
  account_id: string;
  started_at: string;
  ended_at: string | null;
  target_minutes: number;
  is_deleted: number;
  updated_at: string;
}

function fromSqlRow(row: FastingLogSqlRow): LocalFastingLog {
  return {
    id: row.id,
    accountId: row.account_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    targetMinutes: row.target_minutes,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Local SQLite mirror of app.fasting_log (0011), following water-repo.ts's dirty-flag outbox
 * pattern. One row per fast: `start` inserts it with ended_at NULL, `end` stamps ended_at. Which
 * fast is "active" and whether one reached its target is pure logic in packages/shared's
 * fasting.ts (activeFast/completedFasts) - this file only does storage.
 */
export async function start(db: SqlDb, row: Omit<LocalFastingLog, "endedAt" | "isDeleted">): Promise<void> {
  await db.runAsync(
    `INSERT INTO fasting_log (id, account_id, started_at, ended_at, target_minutes, is_deleted, updated_at, is_dirty)
     VALUES (?, ?, ?, NULL, ?, 0, ?, 1)`,
    [row.id, row.accountId, row.startedAt, row.targetMinutes, row.updatedAt],
  );
}

/** Ends a fast at `endedAt` (also the new updated_at). No-op if it's already ended or deleted. */
export async function end(db: SqlDb, id: string, endedAt: string): Promise<void> {
  await db.runAsync(
    `UPDATE fasting_log SET ended_at = ?, updated_at = ?, is_dirty = 1
     WHERE id = ? AND ended_at IS NULL AND is_deleted = 0`,
    [endedAt, endedAt, id],
  );
}

/** Soft-deletes a fast (e.g. one started by mistake). */
export async function softDelete(db: SqlDb, id: string, updatedAt: string): Promise<void> {
  await db.runAsync("UPDATE fasting_log SET is_deleted = 1, updated_at = ?, is_dirty = 1 WHERE id = ?", [
    updatedAt,
    id,
  ]);
}

/** The account's non-deleted fasts, newest first - enough for activeFast() and the history list. */
export async function listRecent(db: SqlDb, accountId: string, limit = 60): Promise<LocalFastingLog[]> {
  const rows = await db.getAllAsync<FastingLogSqlRow>(
    `SELECT * FROM fasting_log WHERE account_id = ? AND is_deleted = 0
     ORDER BY started_at DESC LIMIT ?`,
    [accountId, limit],
  );
  return rows.map(fromSqlRow);
}

export async function getDirty(db: SqlDb): Promise<LocalFastingLog[]> {
  const rows = await db.getAllAsync<FastingLogSqlRow>("SELECT * FROM fasting_log WHERE is_dirty = 1");
  return rows.map(fromSqlRow);
}

export async function markClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE fasting_log SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

export async function applyRemote(db: SqlDb, rows: RemoteFastingLog[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM fasting_log WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO fasting_log (id, account_id, started_at, ended_at, target_minutes, is_deleted, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, started_at = excluded.started_at, ended_at = excluded.ended_at,
           target_minutes = excluded.target_minutes, is_deleted = excluded.is_deleted,
           updated_at = excluded.updated_at, is_dirty = 0`,
        [row.id, row.accountId, row.startedAt, row.endedAt, row.targetMinutes, row.isDeleted ? 1 : 0, row.updatedAt],
      );
    }
  });
}
