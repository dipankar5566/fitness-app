import { Injectable } from "@nestjs/common";
import { foodLogEntrySchema } from "@fitness-app/shared";
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse, SyncPushRow, SyncRejectReason } from "@fitness-app/shared";
import type { PoolClient } from "pg";
import { z, ZodError } from "zod";
import { DatabaseService } from "../database/database.service.js";
import { enrichWithMacros, type FoodLogRow } from "../food-log/food-log.service.js";
import { FoodService } from "../food/food.service.js";

// Delete pushes only need enough to identify the row and apply LWW - the rest of the row shape
// (food_source, quantity, ...) is whatever the client already had locally and isn't re-validated.
const foodLogDeleteRowSchema = z.object({ id: z.string().uuid(), updatedAt: z.string().datetime() });

/** v1 only syncs `food_log` (ARCHITECTURE.md §3); workout_session/workout_set/body_metric join once
 * their screens exist (M3) by adding a branch here - accountId is always taken from the JWT, never
 * from the pushed row, so a row can never be pushed into someone else's account. */
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

        if (pushRow.table !== "food_log") {
          rejected.push({ id: rowId, reason: "invalid" });
          continue;
        }

        try {
          if (pushRow.op === "delete") {
            const row = foodLogDeleteRowSchema.parse(pushRow.row);
            const result = await client.query(
              `UPDATE app.food_log SET is_deleted = true, updated_at = $3, server_updated_at = now()
               WHERE id = $1 AND account_id = $2 AND updated_at <= $3`,
              [row.id, accountId, row.updatedAt],
            );
            if (result.rowCount && result.rowCount > 0) {
              applied.push(row.id);
            } else {
              rejected.push({ id: row.id, reason: await this.conflictReason(client, row.id, accountId) });
            }
            continue;
          }

          const row = foodLogEntrySchema.parse(pushRow.row);
          const result = await client.query(
            `INSERT INTO app.food_log
               (id, account_id, food_source, food_ref, quantity, unit, meal_type, logged_at, source, is_estimate, is_deleted, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
               food_source = EXCLUDED.food_source, food_ref = EXCLUDED.food_ref, quantity = EXCLUDED.quantity,
               unit = EXCLUDED.unit, meal_type = EXCLUDED.meal_type, logged_at = EXCLUDED.logged_at,
               source = EXCLUDED.source, is_estimate = EXCLUDED.is_estimate, is_deleted = EXCLUDED.is_deleted,
               updated_at = EXCLUDED.updated_at, server_updated_at = now()
             WHERE app.food_log.account_id = $2 AND app.food_log.updated_at <= EXCLUDED.updated_at`,
            [
              row.id, accountId, row.foodSource, row.foodRef, row.quantity, row.unit,
              row.mealType, row.loggedAt, row.source, row.isEstimate, row.isDeleted, row.updatedAt,
            ],
          );

          if (result.rowCount && result.rowCount > 0) {
            applied.push(row.id);
          } else {
            rejected.push({ id: row.id, reason: await this.conflictReason(client, row.id, accountId) });
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
   * "server already has an equal-or-newer version" (a genuinely stale push). */
  private async conflictReason(
    client: PoolClient,
    id: string,
    accountId: string,
  ): Promise<SyncRejectReason> {
    const existing = await client.query<{ account_id: string }>(
      "SELECT account_id FROM app.food_log WHERE id = $1",
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

    const result = await this.db.query<FoodLogRow & { server_updated_at: Date }>(
      sinceWithOverlap
        ? `SELECT * FROM app.food_log WHERE account_id = $1 AND server_updated_at > $2 ORDER BY server_updated_at`
        : `SELECT * FROM app.food_log WHERE account_id = $1 ORDER BY server_updated_at`,
      sinceWithOverlap ? [accountId, sinceWithOverlap] : [accountId],
    );

    const enriched = await enrichWithMacros(result.rows, this.food);
    const nextSyncToken =
      result.rows.length > 0
        ? result.rows[result.rows.length - 1].server_updated_at.toISOString()
        : since ?? new Date(0).toISOString();

    const changes: SyncPushRow[] = enriched.map((row) => ({
      table: "food_log",
      op: row.is_deleted ? "delete" : "upsert",
      row: {
        id: row.id,
        accountId: row.account_id,
        isDeleted: row.is_deleted,
        updatedAt: row.updated_at.toISOString(),
        foodSource: row.food_source,
        foodRef: row.food_ref,
        quantity: Number(row.quantity),
        unit: row.unit,
        mealType: row.meal_type,
        loggedAt: row.logged_at.toISOString(),
        source: row.source,
        isEstimate: row.is_estimate,
        macros: row.macros,
      },
    }));

    return { changes, nextSyncToken };
  }
}
