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
