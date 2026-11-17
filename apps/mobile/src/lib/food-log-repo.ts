import type { SqlDb } from "./sql-db";

export interface LocalMacros {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

export interface LocalFoodLogRow {
  id: string;
  accountId: string;
  foodSource: string;
  foodRef: string;
  quantity: number;
  unit: string;
  mealType: string;
  loggedAt: string;
  source: string;
  isEstimate: boolean;
  isDeleted: boolean;
  updatedAt: string;
  macros: LocalMacros | null;
  /** Local-only display snapshot (see db-schema.ts) - null for a row logged before this column
   * existed and not yet backfilled by a pull. */
  foodName: string | null;
}

/** A row pulled from the server via GET /sync - server is always the source of truth for macros. */
export type RemoteFoodLogRow = LocalFoodLogRow;

interface FoodLogSqlRow {
  id: string;
  account_id: string;
  food_source: string;
  food_ref: string;
  quantity: number;
  unit: string;
  meal_type: string;
  logged_at: string;
  source: string;
  is_estimate: number;
  is_deleted: number;
  updated_at: string;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  is_dirty: number;
  food_name: string | null;
}

function fromSqlRow(row: FoodLogSqlRow): LocalFoodLogRow {
  const hasMacros = row.kcal !== null || row.protein_g !== null || row.fat_g !== null || row.carb_g !== null;
  return {
    id: row.id,
    accountId: row.account_id,
    foodSource: row.food_source,
    foodRef: row.food_ref,
    quantity: row.quantity,
    unit: row.unit,
    mealType: row.meal_type,
    loggedAt: row.logged_at,
    source: row.source,
    isEstimate: row.is_estimate === 1,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
    macros: hasMacros
      ? { kcal: row.kcal, proteinG: row.protein_g, fatG: row.fat_g, carbG: row.carb_g }
      : null,
    foodName: row.food_name,
  };
}

/** Writes a freshly-logged entry, marked dirty so the next sync pushes it. */
export async function insert(db: SqlDb, row: LocalFoodLogRow): Promise<void> {
  await db.runAsync(
    `INSERT INTO food_log
       (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source,
        is_estimate, is_deleted, updated_at, kcal, protein_g, fat_g, carb_g, food_name, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id, row.accountId, row.foodSource, row.foodRef, row.quantity, row.unit, row.mealType,
      row.loggedAt, row.source, row.isEstimate ? 1 : 0, row.isDeleted ? 1 : 0, row.updatedAt,
      row.macros?.kcal ?? null, row.macros?.proteinG ?? null, row.macros?.fatG ?? null, row.macros?.carbG ?? null,
      row.foodName,
    ],
  );
}

/** One local calendar day's entries (by the logged_at date prefix); callers already get them in logged_at order. */
export async function listByLocalDay(db: SqlDb, accountId: string, date: string): Promise<LocalFoodLogRow[]> {
  const rows = await db.getAllAsync<FoodLogSqlRow>(
    `SELECT * FROM food_log WHERE account_id = ? AND substr(logged_at, 1, 10) = ? AND is_deleted = 0 ORDER BY logged_at`,
    [accountId, date],
  );
  return rows.map(fromSqlRow);
}

/** Distinct local calendar days (logged_at date prefix, same convention as listByLocalDay) with
 * at least one non-deleted entry on/after `sinceDate` - feeds the streak calculation
 * (packages/shared's computeLoggingStreak), which only needs "which days were logged", not the
 * entries themselves. Unordered; the caller doesn't need these in any particular order. */
export async function listLoggedLocalDays(db: SqlDb, accountId: string, sinceDate: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT substr(logged_at, 1, 10) AS day FROM food_log
     WHERE account_id = ? AND is_deleted = 0 AND substr(logged_at, 1, 10) >= ?`,
    [accountId, sinceDate],
  );
  return rows.map((row) => row.day);
}

export async function softDelete(db: SqlDb, id: string, updatedAt: string): Promise<void> {
  await db.runAsync(
    "UPDATE food_log SET is_deleted = 1, updated_at = ?, is_dirty = 1 WHERE id = ?",
    [updatedAt, id],
  );
}

/** Rows the outbox hasn't successfully pushed yet (never pushed, or edited since the last push started). */
export async function getDirty(db: SqlDb): Promise<LocalFoodLogRow[]> {
  const rows = await db.getAllAsync<FoodLogSqlRow>("SELECT * FROM food_log WHERE is_dirty = 1");
  return rows.map(fromSqlRow);
}

/**
 * Clears the dirty flag for exactly the version that was pushed. If the row was edited again after
 * the push started, its updated_at has moved on and this no-ops - the edit stays dirty and goes out
 * on the next sync (the push-in-flight exception from ARCHITECTURE.md §3).
 */
export async function markClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE food_log SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

/**
 * Applies pulled rows. A local row is overwritten only if it isn't dirty, or if the incoming row is
 * newer than the local edit - otherwise the local pending edit survives and wins the next push.
 * food_name is COALESCEd rather than overwritten outright: the server resolves and sends a name on
 * every pull (sync.service.ts's foodLogAdapter, resolved the same way enrichWithMacros resolves
 * macros), which is exactly what backfills a pre-existing row logged before this column existed -
 * but COALESCE still protects against ever nulling out a good local name on some future pull that
 * can't resolve one (e.g. a food row deleted server-side), rather than silently losing it.
 */
export async function applyRemote(db: SqlDb, rows: RemoteFoodLogRow[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM food_log WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO food_log
           (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source,
            is_estimate, is_deleted, updated_at, kcal, protein_g, fat_g, carb_g, food_name, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, food_source = excluded.food_source, food_ref = excluded.food_ref,
           quantity = excluded.quantity, unit = excluded.unit, meal_type = excluded.meal_type,
           logged_at = excluded.logged_at, source = excluded.source, is_estimate = excluded.is_estimate,
           is_deleted = excluded.is_deleted, updated_at = excluded.updated_at, kcal = excluded.kcal,
           protein_g = excluded.protein_g, fat_g = excluded.fat_g, carb_g = excluded.carb_g,
           food_name = COALESCE(excluded.food_name, food_log.food_name), is_dirty = 0`,
        [
          row.id, row.accountId, row.foodSource, row.foodRef, row.quantity, row.unit, row.mealType,
          row.loggedAt, row.source, row.isEstimate ? 1 : 0, row.isDeleted ? 1 : 0, row.updatedAt,
          row.macros?.kcal ?? null, row.macros?.proteinG ?? null, row.macros?.fatG ?? null, row.macros?.carbG ?? null,
          row.foodName,
        ],
      );
    }
  });
}
