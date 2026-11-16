import { ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

export type AiFeature = "meal_parse_text" | "meal_parse_image" | "coach_chat" | "plan_generate";

/**
 * Rough per-account daily spend cap - a safety guard against a runaway or abusive client, not a
 * tight per-user budget match to PRD §8's "AI cost per MAU ≤ ₹15" (that figure is a to-be-validated
 * MONTHLY AVERAGE across all monthly active users, not a per-account daily ceiling - the two
 * aren't the same number). At current gpt-4o-mini pricing a single meal-text parse costs a small
 * fraction of a cent, so this still allows generous everyday use while bounding worst-case daily
 * cost if something goes wrong. Tune this constant, not the enforcement logic, if it needs to change.
 */
const DAILY_QUOTA_USD = 0.1;

@Injectable()
export class AiUsageService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Throws if this account has already spent at or above the daily quota in the last 24h.
   * ARCHITECTURE.md §5's "cost control: per-account daily quota row in ai_usage" - callers check
   * this before invoking the AI provider, so a blocked request never actually costs anything.
   */
  async checkQuota(accountId: string): Promise<void> {
    const spent = await this.getSpentTodayUsd(accountId);
    if (spent >= DAILY_QUOTA_USD) {
      throw new ForbiddenException("Daily AI usage limit reached. Try again tomorrow.");
    }
  }

  async record(
    accountId: string,
    feature: AiFeature,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO app.ai_usage (account_id, feature, tokens_in, tokens_out, cost_usd)
       VALUES ($1, $2, $3, $4, $5)`,
      [accountId, feature, tokensIn, tokensOut, costUsd],
    );
  }

  private async getSpentTodayUsd(accountId: string): Promise<number> {
    const result = await this.db.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM app.ai_usage
       WHERE account_id = $1 AND created_at >= now() - interval '24 hours'`,
      [accountId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }
}
