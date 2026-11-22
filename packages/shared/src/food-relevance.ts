// Per-meal relevance scoring for foods - powers "what to log next" suggestions per meal
// (breakfast/lunch/snack/dinner). Pure, no I/O: the backfill (db/backfill-meal-relevance.ts) feeds
// it aggregated log counts + a name-derived prior and persists the result in app.food_meal_relevance
// (0007). Our own heuristic ("relevance_v1"); nothing is taken from any third-party food database.
import type { MealType } from "./schemas.ts";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

/** Observed how-often-logged-at-this-meal counts for one food. Missing meals count as 0. */
export type MealRelevanceCounts = Partial<Record<MealType, number>>;

/** A normalized relevance distribution over the four meals (the four values sum to 1). */
export type MealRelevance = Record<MealType, number>;

const UNIFORM_PRIOR: MealRelevance = { breakfast: 0.25, lunch: 0.25, dinner: 0.25, snack: 0.25 };

/**
 * Prior strength in pseudo-observations: at this many real logs the observed data and the prior
 * carry equal weight; beyond it, real logs dominate. Tunable, not load-bearing on exact value.
 */
export const PRIOR_STRENGTH = 8;

/**
 * Blends observed per-meal log counts with a prior into a normalized relevance score per meal
 * (Dirichlet-style smoothing: score_m = (count_m + k*prior_m) / (N + k)). With no logs the score
 * is exactly the prior; as real logs accumulate the prior washes out. Always sums to 1.
 */
export function scoreMealRelevance(
  counts: MealRelevanceCounts,
  prior: MealRelevance = UNIFORM_PRIOR,
  priorStrength: number = PRIOR_STRENGTH,
): MealRelevance {
  const total = MEAL_TYPES.reduce((sum, meal) => sum + Math.max(0, counts[meal] ?? 0), 0);
  const denom = total + priorStrength;
  const out = {} as MealRelevance;
  for (const meal of MEAL_TYPES) {
    const observed = Math.max(0, counts[meal] ?? 0);
    out[meal] = (observed + priorStrength * prior[meal]) / denom;
  }
  return out;
}

// Name hints for the cold-start prior - common Indian dishes by the meal they're typically eaten at.
// Deliberately small and readable; a food matching neither bucket falls back to a heavy-meal
// (lunch/dinner) lean, which is the safe default for most recipes/ingredients.
const BREAKFAST_HINTS = [
  "dosa", "idli", "idly", "poha", "upma", "paratha", "parantha", "chilla", "cheela",
  "uttapam", "uthappam", "omelet", "omelette", "cornflakes", "oats", "porridge", "sabudana",
  "dhokla", "bread", "toast", "muesli", "daliya", "dalia",
];
const SNACK_HINTS = [
  "tea", "coffee", "biscuit", "cookie", "samosa", "pakora", "pakoda", "chaat", "bhel", "vada pav",
  "sandwich", "chips", "namkeen", "juice", "lassi", "kachori", "mathri", "sev", "murukku",
  "cake", "chocolate", "nuts", "fruit",
];

function matchesAny(haystack: string, hints: string[]): boolean {
  return hints.some((hint) => haystack.includes(hint));
}

/**
 * Cold-start prior for a food from its (display) name alone, used before it has enough real logs.
 * Returns a normalized distribution. Breakfast/snack keywords tilt toward those meals; anything
 * else leans toward the heavy meals (lunch/dinner), which fits most recipes and staples.
 */
export function mealPriorForName(name: string): MealRelevance {
  const text = name.toLowerCase();
  const weights: MealRelevance = { breakfast: 1, lunch: 1, dinner: 1, snack: 1 };

  const isBreakfast = matchesAny(text, BREAKFAST_HINTS);
  const isSnack = matchesAny(text, SNACK_HINTS);
  if (isBreakfast) weights.breakfast += 3;
  if (isSnack) weights.snack += 3;
  if (!isBreakfast && !isSnack) {
    weights.lunch += 1.5;
    weights.dinner += 1.5;
  }

  const total = MEAL_TYPES.reduce((sum, meal) => sum + weights[meal], 0);
  const out = {} as MealRelevance;
  for (const meal of MEAL_TYPES) {
    out[meal] = weights[meal] / total;
  }
  return out;
}
