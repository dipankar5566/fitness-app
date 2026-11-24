import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";

/**
 * Moves a guest account's rows onto an existing Google account (ARCHITECTURE.md section 8: "merge
 * by account_id reassignment, not data copy"). Called from AuthService.signInWithGoogle inside
 * DatabaseService.transaction, so every statement here runs against the same client/transaction -
 * a partial merge must never land.
 *
 * Every app.* table that references app.account is covered below; a table added later that follows
 * the same account_id convention needs a line here too (there's no generic/reflective way to do this
 * safely, since singleton and per-day-cache tables need their own conflict rule, not a blind UPDATE).
 */
@Injectable()
export class AccountMergeService {
  async mergeGuestInto(client: PoolClient, guestAccountId: string, targetAccountId: string): Promise<void> {
    await this.mergeProfile(client, guestAccountId, targetAccountId);
    await this.mergeGoal(client, guestAccountId, targetAccountId);
    await this.mergeSingleton(client, "app.streak", "account_id", guestAccountId, targetAccountId);
    await this.mergePerDayCache(client, "app.coach_daily_insight", "insight_date", guestAccountId, targetAccountId);
    await this.mergePerDayCache(client, "app.meal_plan", "plan_date", guestAccountId, targetAccountId);

    for (const table of [
      "app.custom_food",
      "app.custom_food_ingredient",
      "app.food_log",
      "app.workout_session",
      "app.workout_set",
      "app.body_metric",
      "app.water_log",
      "app.fasting_log",
    ]) {
      await client.query(
        `UPDATE ${table} SET account_id = $1, server_updated_at = now() WHERE account_id = $2`,
        [targetAccountId, guestAccountId],
      );
    }

    for (const table of [
      "app.exercise",
      "app.program",
      "app.reminder",
      "app.chat_message",
      "app.ai_usage",
      "app.consent_record",
      "app.food_report",
    ]) {
      await client.query(`UPDATE ${table} SET account_id = $1 WHERE account_id = $2`, [
        targetAccountId,
        guestAccountId,
      ]);
    }

    await client.query("UPDATE app.account SET deleted_at = now() WHERE id = $1", [guestAccountId]);
  }

  /** profile's PK is account_id itself - keep the guest's row only if the target has none. */
  private async mergeProfile(client: PoolClient, guestAccountId: string, targetAccountId: string): Promise<void> {
    const existing = await client.query("SELECT 1 FROM app.profile WHERE account_id = $1", [targetAccountId]);
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query("DELETE FROM app.profile WHERE account_id = $1", [guestAccountId]);
    } else {
      await client.query("UPDATE app.profile SET account_id = $1 WHERE account_id = $2", [
        targetAccountId,
        guestAccountId,
      ]);
    }
  }

  /** If the target already has an active goal, the guest's goal history moves over as inactive -
   * the target's own active goal (and its targets) is what the merged account keeps using. */
  private async mergeGoal(client: PoolClient, guestAccountId: string, targetAccountId: string): Promise<void> {
    const existing = await client.query(
      "SELECT 1 FROM app.goal WHERE account_id = $1 AND is_active",
      [targetAccountId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query("UPDATE app.goal SET is_active = false WHERE account_id = $1", [guestAccountId]);
    }
    await client.query("UPDATE app.goal SET account_id = $1 WHERE account_id = $2", [
      targetAccountId,
      guestAccountId,
    ]);
  }

  /** A singleton-per-account table keyed by account_id alone (e.g. app.streak) - the target's row
   * wins on conflict since there's no way to merge two single summary rows. */
  private async mergeSingleton(
    client: PoolClient,
    table: string,
    pkColumn: string,
    guestAccountId: string,
    targetAccountId: string,
  ): Promise<void> {
    const existing = await client.query(`SELECT 1 FROM ${table} WHERE ${pkColumn} = $1`, [targetAccountId]);
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query(`DELETE FROM ${table} WHERE ${pkColumn} = $1`, [guestAccountId]);
    } else {
      await client.query(`UPDATE ${table} SET ${pkColumn} = $1 WHERE ${pkColumn} = $2`, [
        targetAccountId,
        guestAccountId,
      ]);
    }
  }

  /** A per-account-per-day cache keyed by (account_id, dateColumn) (coach_daily_insight, meal_plan).
   * The target's cached day wins on a date collision; everything else moves over. */
  private async mergePerDayCache(
    client: PoolClient,
    table: string,
    dateColumn: string,
    guestAccountId: string,
    targetAccountId: string,
  ): Promise<void> {
    await client.query(
      `DELETE FROM ${table}
       WHERE account_id = $1
         AND ${dateColumn} IN (SELECT ${dateColumn} FROM ${table} WHERE account_id = $2)`,
      [guestAccountId, targetAccountId],
    );
    await client.query(`UPDATE ${table} SET account_id = $1 WHERE account_id = $2`, [
      targetAccountId,
      guestAccountId,
    ]);
  }
}
