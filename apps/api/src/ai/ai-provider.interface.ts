/**
 * Provider-agnostic AI gateway - ARCHITECTURE.md §5. One interface, swappable implementation
 * (OpenAI chosen, decided per PRD §9's "AI provider(s) & model per task" open question); no
 * feature calls an AI SDK directly (CLAUDE.md "Architecture rules").
 *
 * Deliberately only has parseMealText for now - ARCHITECTURE.md's full sketch also has
 * parseMealImage/chat/generatePlan, but those belong to later M4/M5 roadmap items (photo-based
 * meal parse, AI coach, AI-generated plans) that don't exist yet. Adding stub methods ahead of
 * the features that need them would be exactly the kind of half-finished implementation
 * CLAUDE.md asks not to write - extend this interface when each of those is actually built.
 */

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

export const AI_PROVIDER = Symbol("AiProvider");

export interface AiProvider {
  /** Extracts raw food mentions + quantities from a free-text meal description. No DB knowledge,
   * no food_id resolution - just what the text says. */
  parseMealText(text: string): Promise<RawMealItem[]>;
}
