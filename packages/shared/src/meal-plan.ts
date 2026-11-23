/**
 * AI sample-day meal plan math - PRD §5.5 ("a sample day meal plan meeting targets with Indian foods
 * respecting diet type"; AC: "plans validate against targets (±5 %) before display"). Pure: the API
 * (apps/api/src/meal-plan/) resolves the model's suggestions to real indb foods, then uses these
 * helpers to compute macros from per-100g values, scale portions toward the kcal target, and decide
 * whether the plan is good enough to show at all. The model's own numbers are never trusted - every
 * macro here comes from our food database.
 */
import { z } from "zod";
import { mealTypeSchema } from "./schemas.ts";

/** Allowed deviation of total plan kcal from the target - PRD §5.5's ±5 %. */
export const PLAN_KCAL_TOLERANCE = 0.05;
/** Protein is only bounded from below (more is fine for a gym-goer): at least this share of target. */
export const PLAN_MIN_PROTEIN_FRACTION = 0.85;
/** Portion scaling is clamped so a bad suggestion can't turn into 3x or 0.2x a sane serving. */
export const PLAN_SCALE_MIN = 0.5;
export const PLAN_SCALE_MAX = 2;
/** Scaled portions are rounded to this many grams - "143.7 g of dal" isn't a real instruction. */
export const PLAN_GRAMS_STEP = 5;

export const mealPlanItemSchema = z.object({
  mealType: mealTypeSchema,
  foodSource: z.literal("indb"),
  foodRef: z.string(),
  foodName: z.string(),
  grams: z.number().positive(),
  kcalPer100g: z.number().nonnegative(),
  proteinGPer100g: z.number().nonnegative(),
  carbGPer100g: z.number().nonnegative(),
  fatGPer100g: z.number().nonnegative(),
});
export type MealPlanItem = z.infer<typeof mealPlanItemSchema>;

export const planMacrosSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbG: z.number(),
  fatG: z.number(),
});
export type PlanMacros = z.infer<typeof planMacrosSchema>;

export const mealPlanSchema = z.object({
  planDate: z.string(),
  items: z.array(mealPlanItemSchema),
  totals: planMacrosSchema,
  targets: planMacrosSchema,
});
export type MealPlan = z.infer<typeof mealPlanSchema>;

type PerHundred = Pick<MealPlanItem, "grams" | "kcalPer100g" | "proteinGPer100g" | "carbGPer100g" | "fatGPer100g">;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function itemMacros(item: PerHundred): PlanMacros {
  const f = item.grams / 100;
  return {
    kcal: Math.round(item.kcalPer100g * f),
    proteinG: round1(item.proteinGPer100g * f),
    carbG: round1(item.carbGPer100g * f),
    fatG: round1(item.fatGPer100g * f),
  };
}

export function planTotals(items: readonly PerHundred[]): PlanMacros {
  const sum = { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 };
  for (const item of items) {
    const m = itemMacros(item);
    sum.kcal += m.kcal;
    sum.proteinG += m.proteinG;
    sum.carbG += m.carbG;
    sum.fatG += m.fatG;
  }
  return { kcal: Math.round(sum.kcal), proteinG: round1(sum.proteinG), carbG: round1(sum.carbG), fatG: round1(sum.fatG) };
}

/**
 * Scales every portion by one factor toward the kcal target (clamped to [PLAN_SCALE_MIN,
 * PLAN_SCALE_MAX], grams rounded to PLAN_GRAMS_STEP, never below one step). A uniform factor keeps
 * the plan's macro *ratios* - which the model chose to fit protein/carb/fat - intact.
 */
export function scalePlanToTarget<T extends PerHundred>(items: readonly T[], targetKcal: number): T[] {
  const total = planTotals(items).kcal;
  if (total <= 0 || targetKcal <= 0) return items.map((item) => ({ ...item }));
  const factor = Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, targetKcal / total));
  return items.map((item) => ({
    ...item,
    grams: Math.max(PLAN_GRAMS_STEP, Math.round((item.grams * factor) / PLAN_GRAMS_STEP) * PLAN_GRAMS_STEP),
  }));
}

export interface PlanValidation {
  ok: boolean;
  /** (total - target) / target, e.g. -0.08 = 8 % under. */
  kcalDeviation: number;
  proteinFraction: number;
  /** Human-readable problems, fed back to the model on a retry. Empty when ok. */
  problems: string[];
}

export function validatePlanAgainstTargets(items: readonly PerHundred[], targets: PlanMacros): PlanValidation {
  const totals = planTotals(items);
  const kcalDeviation = targets.kcal > 0 ? (totals.kcal - targets.kcal) / targets.kcal : 0;
  const proteinFraction = targets.proteinG > 0 ? totals.proteinG / targets.proteinG : 1;
  const problems: string[] = [];
  if (items.length === 0) problems.push("The plan has no foods.");
  if (Math.abs(kcalDeviation) > PLAN_KCAL_TOLERANCE) {
    problems.push(`Total is ${totals.kcal} kcal but the target is ${targets.kcal} kcal.`);
  }
  if (proteinFraction < PLAN_MIN_PROTEIN_FRACTION) {
    problems.push(`Protein is ${totals.proteinG} g but the target is ${targets.proteinG} g - add higher-protein foods.`);
  }
  return { ok: problems.length === 0, kcalDeviation, proteinFraction, problems };
}
