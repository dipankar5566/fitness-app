/**
 * Provider-agnostic AI gateway - ARCHITECTURE.md §5. One interface, swappable implementation
 * (OpenAI chosen, decided per PRD §9's "AI provider(s) & model per task" open question); no
 * feature calls an AI SDK directly (CLAUDE.md "Architecture rules").
 *
 * Grown one method at a time as each roadmap item is actually built (parseMealText/parseMealImage
 * for M4; chat for M5's coach; generateMealPlan - the meal half of ARCHITECTURE.md's generatePlan
 * sketch - for Phase E's sample-day plan) rather than stubbing the full sketch up front - adding stub methods ahead of the features that need them would be
 * exactly the kind of half-finished implementation CLAUDE.md asks not to write.
 *
 * All methods take `accountId` (ARCHITECTURE.md's original sketch had a `ctx: UserContext` here;
 * it was dropped when this interface was first written since nothing needed it yet) so the
 * implementation can record real per-call token usage against the right account for the AI usage
 * ledger (app.ai_usage) - recording happens at this layer because it's the one place with the
 * actual token counts from the provider's response, not estimated after the fact.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RawMealItem {
  /** As extracted from the text, in whatever language/script the user wrote it (English, Hindi,
   * Hinglish) - never translated or normalized here. Resolving it to a real food_id in our DB
   * (search-then-match) is the caller's job, not the gateway's (ARCHITECTURE.md §5). */
  name: string;
  quantity: number;
  /** Whatever unit the model inferred - "piece", "bowl", "plate", "g", etc. Not validated against
   * serving_measure here; the resolution step reconciles it against the matched food's own units. */
  unit: string;
}

/** What the meal-plan generator is asked to hit. Every number comes from the account's own targets
 * (ProfileService) - the model is never trusted to pick them. */
export interface MealPlanRequest {
  targetKcal: number;
  targetProteinG: number;
  targetCarbG: number;
  targetFatG: number;
  /** veg | eggetarian | non_veg | vegan | jain - the caller still filters the result itself. */
  dietType: string;
  /** Per-meal kcal budget (splitMealBudgets), so the day is spread sensibly. */
  mealBudgets: Record<"breakfast" | "lunch" | "snack" | "dinner", number>;
  /** Problems with a previous attempt (validatePlanAgainstTargets), for one corrective retry. */
  feedback?: string[];
}

/** One suggested food, by name and an approximate gram weight - resolved to a real indb food and
 * re-costed from our own nutrient data by the caller (MealPlanService), never used as-is. */
export interface RawPlanItem {
  mealType: "breakfast" | "lunch" | "snack" | "dinner";
  name: string;
  grams: number;
}

export const AI_PROVIDER = Symbol("AiProvider");

export interface AiProvider {
  /** Extracts raw food mentions + quantities from a free-text meal description. No DB knowledge,
   * no food_id resolution - just what the text says. */
  parseMealText(accountId: string, text: string): Promise<RawMealItem[]>;

  /** Same extraction, from a single meal photo instead of text. Quantities are a visual portion
   * estimate, not a number the user stated - the caller (AiMealDraftService) always flags these
   * items is_estimate for that reason, regardless of whether the food itself matched. */
  parseMealImage(accountId: string, image: Buffer, mimeType: string): Promise<RawMealItem[]>;

  /** One coach-chat turn. `messages` is the full conversation so far (system prompt + history +
   * the new user message) - the caller (CoachService) owns grounding/safety and builds this list;
   * the provider's only job is to call the model and return its reply text. */
  chat(accountId: string, messages: ChatMessage[]): Promise<string>;

  /** Suggests a one-day Indian meal plan aimed at the request's targets. Names + grams only; the
   * caller resolves, filters by diet, re-costs and validates (MealPlanService). */
  generateMealPlan(accountId: string, request: MealPlanRequest): Promise<RawPlanItem[]>;
}
