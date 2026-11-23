import { Injectable } from "@nestjs/common";
import {
  calculateAgeYears,
  calculateBmr,
  calculateTdee,
  computeCalorieFloor,
  describeCalorieFloorRefusal,
  detectEdSignal,
  ED_SIGNAL_RESPONSE,
  extractCalorieMentions,
  isCalorieTargetSafe,
  MEDICAL_DISCLAIMER,
  mentionsMedicalCondition,
  type CalorieFloor,
  type UserBiometrics,
} from "@fitness-app/shared";
import type { ChatMessage } from "../ai/ai-provider.interface.js";
import { AiService } from "../ai/ai.service.js";
import { DatabaseService } from "../database/database.service.js";
import { FoodLogService } from "../food-log/food-log.service.js";
import { ProfileService } from "../profile/profile.service.js";

interface ChatMessageRow {
  id: string;
  account_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: Date;
}

// Recent turns to include for conversational context, not the whole history - keeps the prompt
// (and the per-call token cost, PRD §9's quota) bounded as a chat grows long.
const CHAT_HISTORY_LIMIT = 20;

const SYSTEM_PROMPT_PREFIX = `You are a supportive fitness and nutrition coach for an Indian \
gym-goer. Answer using the user data given below and cite the specific numbers you used. Keep \
answers short and practical. You are not a medical professional and must never diagnose or \
prescribe treatment - if the user mentions a medical condition, also recommend they check with a \
doctor. Never suggest a daily calorie target below the safe minimum given below.`;

@Injectable()
export class CoachService {
  constructor(
    private readonly ai: AiService,
    private readonly profile: ProfileService,
    private readonly foodLog: FoodLogService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * One coach-chat turn (PRD §5.5). Safety guardrails are deterministic and server-enforced
   * (packages/shared/src/coach-safety.ts), not just prompt wording - an ED signal skips the model
   * call entirely (ED_SIGNAL_RESPONSE), and the model's own reply is scanned afterward for a
   * below-floor calorie suggestion or an unflagged medical condition, since an instruction in the
   * system prompt is not something that can be trusted or deterministically tested on its own.
   */
  async sendMessage(accountId: string, userMessage: string): Promise<{ reply: string }> {
    if (detectEdSignal(userMessage)) {
      await this.persist(accountId, "user", userMessage);
      await this.persist(accountId, "assistant", ED_SIGNAL_RESPONSE);
      return { reply: ED_SIGNAL_RESPONSE };
    }

    const { systemPrompt, floor } = await this.buildSystemPrompt(accountId);
    const history = await this.getHistory(accountId);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((row) => ({ role: row.role as "user" | "assistant", content: row.content })),
      { role: "user", content: userMessage },
    ];

    let reply = await this.ai.chat(accountId, messages);

    if (floor) {
      const unsafeMention = extractCalorieMentions(reply).find(
        (kcal) => kcal > 0 && !isCalorieTargetSafe(kcal, floor),
      );
      if (unsafeMention !== undefined) {
        reply = describeCalorieFloorRefusal(floor);
      }
    }

    if (mentionsMedicalCondition(userMessage) && !reply.includes(MEDICAL_DISCLAIMER)) {
      reply = `${reply}\n\n${MEDICAL_DISCLAIMER}`;
    }

    await this.persist(accountId, "user", userMessage);
    await this.persist(accountId, "assistant", reply);

    return { reply };
  }

  /**
   * A short, encouraging "insight" about the account's day so far, for the Today screen. Cached
   * once per account per day in app.coach_daily_insight (0010) - a same-day call returns the cached
   * text without touching the model, so this costs at most one AI call per account per day. The
   * same grounding and below-floor calorie guardrail as sendMessage apply; it never writes to the
   * chat history. Returns null when the account hasn't onboarded (no targets to speak to).
   */
  async dailyInsight(accountId: string): Promise<{ insight: string } | null> {
    const today = new Date().toISOString().slice(0, 10);
    const cached = await this.db.query<{ content: string }>(
      "SELECT content FROM app.coach_daily_insight WHERE account_id = $1 AND insight_date = $2",
      [accountId, today],
    );
    if (cached.rows[0]) {
      return { insight: cached.rows[0].content };
    }

    const { systemPrompt, floor } = await this.buildSystemPrompt(accountId);
    if (!floor) {
      // Not onboarded yet - no targets/biometrics to ground an insight in; skip rather than guess.
      return null;
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "In one or two short sentences, give me an encouraging, specific insight about my day " +
          "so far based on my data above (calories/protein remaining, how I'm tracking). Don't ask " +
          "me questions.",
      },
    ];

    let insight = await this.ai.chat(accountId, messages);
    const unsafeMention = extractCalorieMentions(insight).find(
      (kcal) => kcal > 0 && !isCalorieTargetSafe(kcal, floor),
    );
    if (unsafeMention !== undefined) {
      insight = describeCalorieFloorRefusal(floor);
    }

    await this.db.query(
      `INSERT INTO app.coach_daily_insight (account_id, insight_date, content) VALUES ($1, $2, $3)
       ON CONFLICT (account_id, insight_date) DO NOTHING`,
      [accountId, today, insight],
    );
    return { insight };
  }

  async getHistory(accountId: string): Promise<ChatMessageRow[]> {
    const result = await this.db.query<ChatMessageRow>(
      `SELECT * FROM app.chat_message WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [accountId, CHAT_HISTORY_LIMIT],
    );
    return result.rows.reverse(); // chronological order, oldest first
  }

  private async persist(accountId: string, role: "user" | "assistant", content: string): Promise<void> {
    await this.db.query(`INSERT INTO app.chat_message (account_id, role, content) VALUES ($1, $2, $3)`, [
      accountId,
      role,
      content,
    ]);
  }

  /**
   * Grounds the system prompt in the user's own targets/biometrics/today's logs. Weight isn't on
   * app.profile (ProfileService.getLatestWeightKg's docstring) so it's fetched separately. Returns
   * a null floor when the account hasn't onboarded yet - there's no BMR to compute without
   * biometrics, so the calorie-floor guardrail can't run (the ED-signal/medical-condition checks
   * still do, since those don't need biometrics).
   */
  private async buildSystemPrompt(
    accountId: string,
  ): Promise<{ systemPrompt: string; floor: CalorieFloor | null }> {
    const { profile, goal } = await this.profile.getProfile(accountId);
    const weightKg = await this.profile.getLatestWeightKg(accountId);

    if (!profile || weightKg === null) {
      return {
        systemPrompt: `${SYSTEM_PROMPT_PREFIX}\n\nThis user hasn't finished onboarding yet, so no \
targets or biometrics are available - encourage them to finish onboarding before giving \
personalized numeric advice.`,
        floor: null,
      };
    }

    const biometrics: UserBiometrics = {
      sex: profile.sex,
      ageYears: calculateAgeYears(profile.dob),
      heightCm: Number(profile.height_cm),
      weightKg,
      activityLevel: profile.activity_level,
    };
    const bmr = calculateBmr(biometrics);
    const tdee = calculateTdee(biometrics);
    const floor = computeCalorieFloor(bmr, tdee);

    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = await this.foodLog.listByDate(accountId, today);
    const loggedKcalToday = todayLogs.reduce((sum, row) => sum + (row.macros?.kcal ?? 0), 0);

    const targetLine = goal
      ? `Daily target: ${goal.target_kcal} kcal, ${goal.target_protein_g}g protein, ` +
        `${goal.target_carb_g}g carbs, ${goal.target_fat_g}g fat (goal mode: ${goal.mode}).`
      : "No active goal/target set yet.";

    const systemPrompt = `${SYSTEM_PROMPT_PREFIX}

User data:
- ${targetLine}
- Estimated BMR: ${bmr} kcal. Estimated TDEE: ${Math.round(tdee)} kcal.
- Safe minimum daily calorie intake: ${floor.minSafeKcal} kcal - never suggest going below this.
- Logged so far today: ~${Math.round(loggedKcalToday)} kcal.`;

    return { systemPrompt, floor };
  }
}
