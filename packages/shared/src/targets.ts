/**
 * Daily calorie/macro target formulas — PRD.md §5.1.
 * Pure, deterministic, no I/O: safe to run offline on-device and unit-test in isolation.
 */

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalMode = "bulk" | "cut" | "recomp" | "maintain";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Cut/bulk % adjustment to TDEE, midpoint of the PRD's stated range (cut -15..-20%, bulk +8..+12%).
const GOAL_ADJUSTMENT_PCT: Record<GoalMode, number> = {
  cut: -0.175,
  bulk: 0.1,
  recomp: 0,
  maintain: 0,
};

// Protein g/kg bodyweight by goal — PRD: 1.6-2.2 g/kg, cut highest.
const PROTEIN_G_PER_KG: Record<GoalMode, number> = {
  cut: 2.2,
  recomp: 2.0,
  bulk: 1.8,
  maintain: 1.6,
};

const MIN_FAT_G_PER_KG = 0.6;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;
const TRAINING_DAY_CARB_ADJUSTMENT_PCT = 0.1; // training day +10%, rest day -10%, same weekly average

export interface UserBiometrics {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
}

/** Mifflin-St Jeor BMR (kcal/day). */
export function calculateBmr({ sex, ageYears, heightCm, weightKg }: UserBiometrics): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

/** Total daily energy expenditure: BMR x activity factor. */
export function calculateTdee(biometrics: UserBiometrics): number {
  return calculateBmr(biometrics) * ACTIVITY_FACTOR[biometrics.activityLevel];
}

/**
 * Daily macro targets for a goal, holding weekly average kcal constant while shifting
 * carbs up on training days and down on rest days (PRD §5.1 "training-day carb cycling").
 */
export function calculateMacroTargets(
  biometrics: UserBiometrics,
  goal: GoalMode,
  isTrainingDay: boolean,
): MacroTargets {
  const tdee = calculateTdee(biometrics);
  const kcal = Math.round(tdee * (1 + GOAL_ADJUSTMENT_PCT[goal]));

  const proteinG = Math.round(biometrics.weightKg * PROTEIN_G_PER_KG[goal]);
  const fatG = Math.round(Math.max(biometrics.weightKg * MIN_FAT_G_PER_KG, (kcal * 0.25) / KCAL_PER_G_FAT));

  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;
  const fatKcal = fatG * KCAL_PER_G_FAT;
  const baseCarbKcal = Math.max(0, kcal - proteinKcal - fatKcal);
  const carbAdjustment = isTrainingDay ? 1 + TRAINING_DAY_CARB_ADJUSTMENT_PCT : 1 - TRAINING_DAY_CARB_ADJUSTMENT_PCT;
  const carbG = Math.round((baseCarbKcal * carbAdjustment) / KCAL_PER_G_CARB);

  return { kcal, proteinG, fatG, carbG };
}

/** Whole years between a DOB (YYYY-MM-DD) and `now` - used to turn a stored dob into ageYears. */
export function calculateAgeYears(dob: string, now: Date = new Date()): number {
  const birth = new Date(dob);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

/** 1-rep-max estimate (Epley formula), used for workout PRs. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
