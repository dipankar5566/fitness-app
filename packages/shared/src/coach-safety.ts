/**
 * Deterministic safety guardrails for the AI coach — PRD §5.5: "no medical diagnosis; disclaimer;
 * refuses extreme deficits (< BMR or > 25% deficit); flags eating-disorder signals with resources;
 * suggests a doctor for medical conditions." These checks are pure and don't depend on the model's
 * own judgment, which can't be fully trusted or deterministically tested - the model is also
 * instructed via the system prompt (apps/api/src/coach/coach.service.ts), but these functions are
 * what the adversarial-prompt tests (ROADMAP.md M5 exit criteria: "refuses 5 scripted unsafe
 * prompts") actually pin down, and what let the server enforce the rule even if the model doesn't.
 */

export interface CalorieFloor {
  bmrKcal: number;
  /** The higher of "never below BMR" and "never more than 25% below TDEE" - both limits must hold
   * at once, so the floor is whichever one is less permissive. */
  minSafeKcal: number;
}

export function computeCalorieFloor(bmrKcal: number, tdeeKcal: number): CalorieFloor {
  const maxDeficitFloor = tdeeKcal * 0.75; // PRD: "refuses ... > 25% deficit"
  return { bmrKcal: Math.round(bmrKcal), minSafeKcal: Math.round(Math.max(bmrKcal, maxDeficitFloor)) };
}

export function isCalorieTargetSafe(targetKcal: number, floor: CalorieFloor): boolean {
  return targetKcal >= floor.minSafeKcal;
}

/**
 * Any "NNNN kcal" / "NNNN calories" mentions in free text - a deterministic post-hoc scan of the
 * model's own reply, defense-in-depth alongside the system-prompt instruction (a model can ignore
 * an instruction; this can't). Deliberately simple over clever: a false positive here just means
 * an extra, harmless safety message instead of the model's own wording, not a missed unsafe one.
 */
export function extractCalorieMentions(text: string): number[] {
  const matches = text.matchAll(/(\d{3,5})\s*(?:kcal|calories?)\b/gi);
  return [...matches].map((match) => Number(match[1]));
}

/**
 * Curated, deliberately broad eating-disorder signal patterns. False positives (flagging a
 * borderline message) are the safe failure mode here - they just produce a supportive, non-diet
 * response instead of coaching advice; false negatives are the unsafe direction, so this list
 * errs toward over-matching rather than precision.
 */
const ED_SIGNAL_PATTERNS: RegExp[] = [
  /\bpurg(e|ing|ed)\b/i,
  /\bmake myself (throw up|vomit)\b/i,
  /\bthrow(ing)? up (after|to avoid)\b/i,
  /\bstarv(e|ing|ed) (myself|ourselves)\b/i,
  /\b(binge|binging) and (purge|purging)\b/i,
  /\b(hate|disgusted by) my body\b/i,
  /\bwant(ed)? to disappear\b/i,
  /\bskip(ping)? (all )?meals? (for days|to lose weight)\b/i,
  /\bnot eating (at all|for \d+ days?)\b/i,
];

/** A stated daily calorie count low enough to be a red flag on its own, independent of phrasing
 * (e.g. "500 calories a day") - checked numerically rather than by a brittle phrasing regex. */
const ED_SIGNAL_CALORIE_THRESHOLD = 800;

export function detectEdSignal(message: string): boolean {
  if (ED_SIGNAL_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }
  return extractCalorieMentions(message).some((kcal) => kcal > 0 && kcal < ED_SIGNAL_CALORIE_THRESHOLD);
}

const MEDICAL_CONDITION_PATTERNS: RegExp[] = [
  /\bdiabet(es|ic)\b/i,
  /\bthyroid\b/i,
  /\bpcos\b/i,
  /\bpregnan(t|cy)\b/i,
  /\bheart (condition|disease|attack)\b/i,
  /\binjur(y|ed|ies)\b/i,
  /\bmedicat(ion|ed)\b/i,
  /\bsurger(y|ies)\b/i,
];

export function mentionsMedicalCondition(message: string): boolean {
  return MEDICAL_CONDITION_PATTERNS.some((pattern) => pattern.test(message));
}

export const MEDICAL_DISCLAIMER =
  "I'm not a medical professional and can't diagnose or treat medical conditions - please check with a doctor for anything medical.";

export const ED_SIGNAL_RESPONSE =
  "I'm really glad you reached out, and I want you to know you're not alone in this. I'm not able " +
  "to give diet or exercise advice right now because what you're describing sounds like it could be " +
  "connected to disordered eating, and that deserves care from a real person, not an app. Please " +
  "consider reaching out to a doctor, counsellor, or a helpline like iCall (+91 9152987821) or the " +
  "Vandrevala Foundation (1860-2662-345) - both offer free, confidential support in India. You " +
  "matter, and this is worth talking to someone about.";

export function describeCalorieFloorRefusal(floor: CalorieFloor): string {
  return (
    `I can't recommend going below ${floor.minSafeKcal} kcal/day - that's either your estimated ` +
    `BMR (${floor.bmrKcal} kcal, the minimum your body needs at rest) or 25% below your maintenance ` +
    `calories, whichever is higher. Going lower than that isn't safe to sustain. ${MEDICAL_DISCLAIMER}`
  );
}

/** Starter prompt chips shown on an empty coach thread - our own copy, grounded in the data the
 * coach actually has (targets, today's logs, training). Not AI-generated; a fixed, safe starting set. */
export const COACH_PROMPT_SUGGESTIONS: readonly string[] = [
  "How am I doing on my targets today?",
  "What should I eat for dinner to hit my protein goal?",
  "Suggest a high-protein vegetarian breakfast.",
  "Is my calorie target right for my goal?",
];
