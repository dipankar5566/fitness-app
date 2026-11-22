/**
 * Pure helpers for the mobile "Today" screen's meal-grouped diary + hero calorie ring. Kept here
 * (not in apps/mobile) per the "formulas stay pure and unit-tested" rule - these take a structural
 * shape compatible with apps/mobile's LocalFoodLogRow/LocalMacros without importing from apps/mobile
 * (packages/shared has no app dependencies).
 */

export const MEAL_DISPLAY_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealDisplayType = (typeof MEAL_DISPLAY_ORDER)[number];

export interface SummarizableMacros {
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
}

export interface SummarizableFoodLogEntry {
  mealType: string;
  macros: SummarizableMacros | null;
}

export interface MealGroup<T extends SummarizableFoodLogEntry> {
  mealType: MealDisplayType;
  entries: T[];
  kcalSubtotal: number;
}

/**
 * Groups entries by meal type in a fixed display order (breakfast -> lunch -> snack -> dinner,
 * MEAL_DISPLAY_ORDER), each with its own kcal subtotal. An entry with an unrecognized mealType
 * (future meal types, bad data) is dropped from the grouped result rather than guessed into a
 * bucket - callers that need every entry accounted for should sum `entries.length` against their
 * own input length to detect this.
 */
export function groupFoodLogByMeal<T extends SummarizableFoodLogEntry>(entries: readonly T[]): MealGroup<T>[] {
  return MEAL_DISPLAY_ORDER.map((mealType) => {
    const group = entries.filter((entry) => entry.mealType === mealType);
    const kcalSubtotal = group.reduce((sum, entry) => sum + (entry.macros?.kcal ?? 0), 0);
    return { mealType, entries: group, kcalSubtotal };
  });
}

/** Sums kcal across every entry regardless of meal type - the hero ring's "eaten so far". */
export function sumKcal(entries: readonly SummarizableFoodLogEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.macros?.kcal ?? 0), 0);
}

/**
 * Fraction of the daily calorie target eaten so far, clamped to [0, 1] for rendering a ring/bar
 * (going over budget should fill the ring, not overflow past it - the numeric "kcal left" below
 * is what shows the account is over, matching how HealthifyMe's nutrition card flips rather than
 * overflows past 100%).
 */
export function calorieRingProgress(eatenKcal: number, targetKcal: number): number {
  if (targetKcal <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, eatenKcal / targetKcal));
}

/** Can be negative once the account has eaten past its target - that's a real "over by Nkcal" fact. */
export function kcalRemaining(eatenKcal: number, targetKcal: number): number {
  return Math.round(targetKcal - eatenKcal);
}

/** Default share of the daily calorie budget per meal (sums to 1). A reasonable Indian-day split -
 * a modest breakfast, lunch as the largest meal, a light snack, a solid dinner. Tunable. */
export const DEFAULT_MEAL_SPLIT: Record<MealDisplayType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.1,
  dinner: 0.3,
};

/**
 * Splits a daily calorie target into a per-meal budget. The four budgets always sum exactly to
 * round(dailyKcal) - the last meal in MEAL_DISPLAY_ORDER absorbs any rounding remainder so the
 * parts never drift from the whole. A non-positive target yields all zeros. Pure; drives the
 * "eaten / budget" line on each Today meal section.
 */
export function splitMealBudgets(
  dailyKcal: number,
  split: Record<MealDisplayType, number> = DEFAULT_MEAL_SPLIT,
): Record<MealDisplayType, number> {
  const out = {} as Record<MealDisplayType, number>;
  if (dailyKcal <= 0) {
    for (const meal of MEAL_DISPLAY_ORDER) out[meal] = 0;
    return out;
  }
  const total = Math.round(dailyKcal);
  let allocated = 0;
  MEAL_DISPLAY_ORDER.forEach((meal, index) => {
    if (index < MEAL_DISPLAY_ORDER.length - 1) {
      out[meal] = Math.round(total * split[meal]);
      allocated += out[meal];
    } else {
      out[meal] = total - allocated; // last meal takes the remainder, keeping the sum exact
    }
  });
  return out;
}
