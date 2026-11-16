import { Injectable } from "@nestjs/common";
import { customFoodIngredientSchema, customFoodSchema, foodLogEntrySchema } from "@fitness-app/shared";
import type {
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncPushRow,
  SyncRejectReason,
  SyncTableName,
} from "@fitness-app/shared";
import type { PoolClient } from "pg";
import { z, ZodError, type ZodTypeAny } from "zod";
import { DatabaseService } from "../database/database.service.js";
import { enrichWithMacros, type FoodLogRow } from "../food-log/food-log.service.js";
import { FoodService } from "../food/food.service.js";

interface DeleteRow {
  id: string;
  updatedAt: string;
}

// Delete pushes only need enough to identify the row and apply LWW - the rest of the row shape is
// whatever the client already had locally and isn't re-validated. Same shape for every table.
const deleteRowSchema: ZodTypeAny = z.object({ id: z.string().uuid(), updatedAt: z.string().datetime() });

interface TableAdapter {
  upsertSchema: ZodTypeAny;
  deleteSchema: ZodTypeAny;
  conflictTable: string; // fixed literal below, never request-derived - safe to interpolate into SQL
  upsertSql: string;
  upsertParams(accountId: string, row: Record<string, unknown>): unknown[];
  deleteSql: string;
  deleteParams(accountId: string, row: DeleteRow): unknown[];
  selectSql(hasSince: boolean): string;
  toChangeRow(dbRow: Record<string, unknown>): Record<string, unknown>;
}

const foodLogAdapter: TableAdapter = {
  upsertSchema: foodLogEntrySchema,
  deleteSchema: deleteRowSchema,
  conflictTable: "app.food_log",
  upsertSql: `INSERT INTO app.food_log
       (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source, is_estimate, is_deleted, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       food_source = EXCLUDED.food_source, food_ref = EXCLUDED.food_ref, quantity = EXCLUDED.quantity,
       unit = EXCLUDED.unit, meal_type = EXCLUDED.meal_type, logged_at = EXCLUDED.logged_at,
       source = EXCLUDED.source, is_estimate = EXCLUDED.is_estimate, is_deleted = EXCLUDED.is_deleted,
       updated_at = EXCLUDED.updated_at, server_updated_at = now()
     WHERE app.food_log.account_id = $2 AND app.food_log.updated_at <= EXCLUDED.updated_at`,
  upsertParams: (accountId, row) => [
    row.id, accountId, row.foodSource, row.foodRef, row.quantity, row.unit,
    row.mealType, row.loggedAt, row.source, row.isEstimate, row.isDeleted, row.updatedAt,
  ],
  deleteSql: `UPDATE app.food_log SET is_deleted = true, updated_at = $3, server_updated_at = now()
     WHERE id = $1 AND account_id = $2 AND updated_at <= $3`,
  deleteParams: (accountId, row) => [row.id, accountId, row.updatedAt],
  selectSql: (hasSince) =>
    hasSince
      ? "SELECT * FROM app.food_log WHERE account_id = $1 AND server_updated_at > $2 ORDER BY server_updated_at"
      : "SELECT * FROM app.food_log WHERE account_id = $1 ORDER BY server_updated_at",
  toChangeRow: (row) => ({
    id: row.id,
    accountId: row.account_id,
    isDeleted: row.is_deleted,
    updatedAt: (row.updated_at as Date).toISOString(),
    foodSource: row.food_source,
    foodRef: row.food_ref,
    quantity: Number(row.quantity),
    unit: row.unit,
    mealType: row.meal_type,
    loggedAt: (row.logged_at as Date).toISOString(),
    source: row.source,
    isEstimate: row.is_estimate,
    macros: row.macros,
  }),
};

const customFoodAdapter: TableAdapter = {
  upsertSchema: customFoodSchema,
  deleteSchema: deleteRowSchema,
  conflictTable: "app.custom_food",
  upsertSql: `INSERT INTO app.custom_food (id, account_id, name, is_deleted, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at, server_updated_at = now()
     WHERE app.custom_food.account_id = $2 AND app.custom_food.updated_at <= EXCLUDED.updated_at`,
  upsertParams: (accountId, row) => [row.id, accountId, row.name, row.isDeleted, row.updatedAt],
  deleteSql: `UPDATE app.custom_food SET is_deleted = true, updated_at = $3, server_updated_at = now()
     WHERE id = $1 AND account_id = $2 AND updated_at <= $3`,
  deleteParams: (accountId, row) => [row.id, accountId, row.updatedAt],
  selectSql: (hasSince) =>
    hasSince
      ? "SELECT * FROM app.custom_food WHERE account_id = $1 AND server_updated_at > $2 ORDER BY server_updated_at"
      : "SELECT * FROM app.custom_food WHERE account_id = $1 ORDER BY server_updated_at",
  toChangeRow: (row) => ({
    id: row.id,
    accountId: row.account_id,
    isDeleted: row.is_deleted,
    updatedAt: (row.updated_at as Date).toISOString(),
    name: row.name,
  }),
};

const customFoodIngredientAdapter: TableAdapter = {
  upsertSchema: customFoodIngredientSchema,
  deleteSchema: deleteRowSchema,
  conflictTable: "app.custom_food_ingredient",
  upsertSql: `INSERT INTO app.custom_food_ingredient
       (id, account_id, custom_food_id, food_source, food_ref, quantity_g, is_deleted, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       custom_food_id = EXCLUDED.custom_food_id, food_source = EXCLUDED.food_source, food_ref = EXCLUDED.food_ref,
       quantity_g = EXCLUDED.quantity_g, is_deleted = EXCLUDED.is_deleted, updated_at = EXCLUDED.updated_at,
       server_updated_at = now()
     WHERE app.custom_food_ingredient.account_id = $2 AND app.custom_food_ingredient.updated_at <= EXCLUDED.updated_at`,
  upsertParams: (accountId, row) => [
    row.id, accountId, row.customFoodId, row.foodSource, row.foodRef, row.quantityG, row.isDeleted, row.updatedAt,
  ],
  deleteSql: `UPDATE app.custom_food_ingredient SET is_deleted = true, updated_at = $3, server_updated_at = now()
     WHERE id = $1 AND account_id = $2 AND updated_at <= $3`,
  deleteParams: (accountId, row) => [row.id, accountId, row.updatedAt],
  selectSql: (hasSince) =>
    hasSince
      ? "SELECT * FROM app.custom_food_ingredient WHERE account_id = $1 AND server_updated_at > $2 ORDER BY server_updated_at"
      : "SELECT * FROM app.custom_food_ingredient WHERE account_id = $1 ORDER BY server_updated_at",
  toChangeRow: (row) => ({
    id: row.id,
    accountId: row.account_id,
    isDeleted: row.is_deleted,
    updatedAt: (row.updated_at as Date).toISOString(),
    customFoodId: row.custom_food_id,
    foodSource: row.food_source,
    foodRef: row.food_ref,
    quantityG: Number(row.quantity_g),
  }),
};

/** One adapter per syncable table actually wired up so far - workout_session/workout_set/body_metric
 * join the same way once their screens exist (M3): add an adapter, add it here, done. push()/pull()
 * never special-case a table beyond this map (food_log's macro enrichment in pull() is the one
 * exception, since macros aren't part of the row's own stored columns). accountId is always taken
 * from the JWT, never the pushed row, so a row can never be pushed into someone else's account. */
const registry: Partial<Record<SyncTableName, TableAdapter>> = {
  food_log: foodLogAdapter,
  custom_food: customFoodAdapter,
  custom_food_ingredient: customFoodIngredientAdapter,
};

@Injectable()
export class SyncService {
  constructor(
    private readonly db: DatabaseService,
    private readonly food: FoodService,
  ) {}

  async push(accountId: string, request: SyncPushRequest): Promise<SyncPushResponse> {
    const applied: string[] = [];
    const rejected: { id: string; reason: SyncRejectReason }[] = [];

    await this.db.transaction(async (client) => {
      for (const pushRow of request.rows) {
        const rowId = typeof pushRow.row.id === "string" ? pushRow.row.id : "unknown";
        const adapter = registry[pushRow.table];
        if (!adapter) {
          rejected.push({ id: rowId, reason: "invalid" });
          continue;
        }

        try {
          if (pushRow.op === "delete") {
            const row = adapter.deleteSchema.parse(pushRow.row) as DeleteRow;
            const result = await client.query(adapter.deleteSql, adapter.deleteParams(accountId, row));
            if (result.rowCount && result.rowCount > 0) {
              applied.push(row.id);
            } else {
              rejected.push({
                id: row.id,
                reason: await this.conflictReason(client, adapter.conflictTable, row.id, accountId),
              });
            }
            continue;
          }

          const row = adapter.upsertSchema.parse(pushRow.row) as Record<string, unknown> & { id: string };
          const result = await client.query(adapter.upsertSql, adapter.upsertParams(accountId, row));
          if (result.rowCount && result.rowCount > 0) {
            applied.push(row.id);
          } else {
            rejected.push({
              id: row.id,
              reason: await this.conflictReason(client, adapter.conflictTable, row.id, accountId),
            });
          }
        } catch (error) {
          if (error instanceof ZodError) {
            rejected.push({ id: rowId, reason: "invalid" });
            continue;
          }
          throw error;
        }
      }
    });

    return { applied, rejected };
  }

  /** Called only when an upsert/delete didn't affect a row - tells apart "someone else's id" from
   * "server already has an equal-or-newer version" (a genuinely stale push). `table` only ever comes
   * from this file's own adapter.conflictTable constants, never from the request. */
  private async conflictReason(
    client: PoolClient,
    table: string,
    id: string,
    accountId: string,
  ): Promise<SyncRejectReason> {
    const existing = await client.query<{ account_id: string }>(
      `SELECT account_id FROM ${table} WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      // Row vanished mid-transaction (shouldn't happen outside concurrent pushes) - not a real conflict.
      return "stale";
    }
    return existing.rows[0].account_id === accountId ? "stale" : "not_owner";
  }

  async pull(accountId: string, since: string | null): Promise<SyncPullResponse> {
    // 5s overlap on the cursor: covers transactions that commit slightly out of order around the
    // boundary; safe because the client applies pulled rows idempotently.
    const sinceWithOverlap = since ? new Date(new Date(since).getTime() - 5000).toISOString() : null;

    const changes: SyncPushRow[] = [];
    let maxServerUpdatedAt: string | null = null;

    for (const [table, adapter] of Object.entries(registry) as [SyncTableName, TableAdapter][]) {
      const result = await this.db.query<Record<string, unknown> & { server_updated_at: Date; is_deleted: boolean }>(
        adapter.selectSql(sinceWithOverlap !== null),
        sinceWithOverlap ? [accountId, sinceWithOverlap] : [accountId],
      );
      if (result.rows.length === 0) {
        continue;
      }

      const rows =
        table === "food_log"
          ? await enrichWithMacros(result.rows as unknown as FoodLogRow[], this.food, this.db)
          : result.rows;

      for (const row of rows) {
        const typedRow = row as unknown as Record<string, unknown> & { server_updated_at: Date; is_deleted: boolean };
        changes.push({ table, op: typedRow.is_deleted ? "delete" : "upsert", row: adapter.toChangeRow(typedRow) });
        const serverUpdatedAt = typedRow.server_updated_at.toISOString();
        if (!maxServerUpdatedAt || serverUpdatedAt > maxServerUpdatedAt) {
          maxServerUpdatedAt = serverUpdatedAt;
        }
      }
    }

    return { changes, nextSyncToken: maxServerUpdatedAt ?? since ?? new Date(0).toISOString() };
  }
}
