import type { SqlDb } from "./sql-db";

export interface LocalBodyMetric {
  id: string;
  accountId: string;
  metricType: string;
  value: number | null;
  photoRef: string | null;
  recordedAt: string;
  isDeleted: boolean;
  updatedAt: string;
}

/** A row pulled from the server via GET /sync. */
export type RemoteBodyMetric = LocalBodyMetric;

interface BodyMetricSqlRow {
  id: string;
  account_id: string;
  metric_type: string;
  value: number | null;
  photo_ref: string | null;
  recorded_at: string;
  is_deleted: number;
  updated_at: string;
}

function fromSqlRow(row: BodyMetricSqlRow): LocalBodyMetric {
  return {
    id: row.id,
    accountId: row.account_id,
    metricType: row.metric_type,
    value: row.value,
    photoRef: row.photo_ref,
    recordedAt: row.recorded_at,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Local SQLite mirror of app.body_metric (CLAUDE.md M5: Health Connect read + opt-in write),
 * following the same outbox pattern as workout-repo.ts/custom-food-repo.ts. The only writer today
 * is lib/health-connect.ts's weight import - `insert` uses `INSERT OR IGNORE` rather than the
 * plain INSERT food-log-repo.ts/workout-repo.ts use, since a Health Connect import is called
 * repeatedly with the *same* deterministic id for an already-imported record (re-running the
 * import must be idempotent, not throw on the primary-key conflict); a past measurement's value
 * never changes after the fact, so silently keeping the existing row is always correct here.
 */
export async function insert(db: SqlDb, row: LocalBodyMetric): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO body_metric
       (id, account_id, metric_type, value, photo_ref, recorded_at, is_deleted, updated_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.accountId, row.metricType, row.value, row.photoRef, row.recordedAt, row.isDeleted ? 1 : 0, row.updatedAt],
  );
}

/** The most recent reading of a given type (e.g. "weight_kg") - what a "last weighed: 72kg on
 * 14 Nov" display reads, and incidentally what the server's own ProfileService.getLatestWeightKg
 * already does against app.body_metric once this row has synced - no separate mobile-side
 * "latest weight" plumbing is needed for the coach's grounding, only for showing it locally. */
export async function getLatest(db: SqlDb, accountId: string, metricType: string): Promise<LocalBodyMetric | null> {
  const row = await db.getFirstAsync<BodyMetricSqlRow>(
    `SELECT * FROM body_metric WHERE account_id = ? AND metric_type = ? AND is_deleted = 0
     ORDER BY recorded_at DESC LIMIT 1`,
    [accountId, metricType],
  );
  return row ? fromSqlRow(row) : null;
}

export async function getDirty(db: SqlDb): Promise<LocalBodyMetric[]> {
  const rows = await db.getAllAsync<BodyMetricSqlRow>("SELECT * FROM body_metric WHERE is_dirty = 1");
  return rows.map(fromSqlRow);
}

export async function markClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE body_metric SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

export async function applyRemote(db: SqlDb, rows: RemoteBodyMetric[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM body_metric WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO body_metric (id, account_id, metric_type, value, photo_ref, recorded_at, is_deleted, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, metric_type = excluded.metric_type, value = excluded.value,
           photo_ref = excluded.photo_ref, recorded_at = excluded.recorded_at, is_deleted = excluded.is_deleted,
           updated_at = excluded.updated_at, is_dirty = 0`,
        [row.id, row.accountId, row.metricType, row.value, row.photoRef, row.recordedAt, row.isDeleted ? 1 : 0, row.updatedAt],
      );
    }
  });
}
