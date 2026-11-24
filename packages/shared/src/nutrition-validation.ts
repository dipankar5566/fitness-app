/**
 * Pure, side-effect-free nutrition data QA rules (audit brief section 9/15). Every function here
 * only *flags* - none of them clamp, zero-out, or otherwise alter a value. `db/audit-food-data.ts`
 * uses these to build its CSV report; a future data-load/CI gate (Phase 5+) can reuse them
 * unchanged, same as `diet.ts`'s classifier is reused by both the backfill script and `/food/search`.
 */

export type ValidationSeverity = "info" | "warning" | "critical";

export interface ValidationFlag {
  rule: string;
  severity: ValidationSeverity;
  message: string;
}

export interface NutrientProfile {
  kcalPer100g: number | null;
  proteinGPer100g: number | null;
  fatGPer100g: number | null;
  carbGPer100g: number | null;
  fibreGPer100g: number | null;
}

/** Energy factors (Atwater general system): 4 kcal/g protein, 9 kcal/g fat, 4 kcal/g
 * carbohydrate, plus 2 kcal/g dietary fibre (the commonly used "general" fibre convention - some
 * sources use 0; this is a cross-check tolerance band, not a replacement value, so the exact
 * convention only widens or narrows the flagged set, never changes a stored number). */
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FIBRE = 2;

/** Checks a food's negative values and mass balance. Missing (null) values are never treated as
 * zero - a null simply contributes nothing to the sums below and is reported as its own flag by
 * the caller (missing-value counting lives in the audit script, not here, since "is this nutrient
 * expected at all" depends on food_type/category context this module doesn't have). */
export function validateNutrientProfile(profile: NutrientProfile): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  const fields: [string, number | null][] = [
    ["kcal", profile.kcalPer100g],
    ["protein_g", profile.proteinGPer100g],
    ["fat_g", profile.fatGPer100g],
    ["carb_g", profile.carbGPer100g],
    ["fibre_g", profile.fibreGPer100g],
  ];
  for (const [name, value] of fields) {
    if (value !== null && value < 0) {
      flags.push({ rule: "negative_value", severity: "critical", message: `${name} is negative (${value})` });
    }
  }

  const macroSum =
    (profile.proteinGPer100g ?? 0) + (profile.fatGPer100g ?? 0) + (profile.carbGPer100g ?? 0);
  // Water + ash + alcohol fill the rest of 100g, so protein+fat+carb alone should not exceed
  // ~100g; a small tolerance (2g) covers rounding in source data.
  if (macroSum > 102) {
    flags.push({
      rule: "mass_balance",
      severity: "critical",
      message: `protein+fat+carb per 100g (${macroSum.toFixed(1)}) exceeds 100g`,
    });
  }

  return flags;
}

export interface EnergyConsistencyOptions {
  /** Relative tolerance before flagging, e.g. 0.15 = flag anything >15% off. */
  tolerance: number;
}

/**
 * Cross-checks a food's stated energy against the Atwater-general estimate from its own
 * macros. This NEVER produces a corrected kcal value - it only flags a mismatch for human review,
 * since real foods can legitimately deviate (fibre conventions, organic acids, alcohol, or a
 * source-specific energy factor the general formula doesn't capture - brief section 9).
 */
export function energyConsistency(
  profile: NutrientProfile,
  options: EnergyConsistencyOptions,
): ValidationFlag[] {
  if (profile.kcalPer100g === null || profile.kcalPer100g <= 0) {
    return [];
  }
  if (profile.proteinGPer100g === null && profile.fatGPer100g === null && profile.carbGPer100g === null) {
    // Nothing to cross-check against - not a flag, just nothing to say.
    return [];
  }

  const estimated =
    KCAL_PER_G_PROTEIN * (profile.proteinGPer100g ?? 0) +
    KCAL_PER_G_FAT * (profile.fatGPer100g ?? 0) +
    KCAL_PER_G_CARB * (profile.carbGPer100g ?? 0) +
    KCAL_PER_G_FIBRE * (profile.fibreGPer100g ?? 0);

  const deviation = (estimated - profile.kcalPer100g) / profile.kcalPer100g;
  if (Math.abs(deviation) <= options.tolerance) {
    return [];
  }

  const severity: ValidationSeverity = Math.abs(deviation) > 0.3 ? "critical" : "warning";
  return [
    {
      rule: "energy_consistency",
      severity,
      message: `stated kcal ${profile.kcalPer100g.toFixed(0)} vs Atwater-estimated ${estimated.toFixed(0)} (${(deviation * 100).toFixed(0)}% deviation)`,
    },
  ];
}

export interface ServingPlausibilityRange {
  /** e.g. "egg", "chapati", "bowl" - matched case-insensitively against the serving unit name. */
  unitNamePattern: RegExp;
  minGrams: number;
  maxGrams: number;
}

/** A conservative, documented set of plausible gram ranges for common serving-unit names, used
 * only to flag an implausible `serving_measure.grams` value for review - never to replace it. Not
 * exhaustive: a unit matching no pattern here is simply not checked (silence, not a false flag). */
export const DEFAULT_SERVING_PLAUSIBILITY_RANGES: ServingPlausibilityRange[] = [
  { unitNamePattern: /egg/i, minGrams: 35, maxGrams: 70 },
  { unitNamePattern: /chapati|roti|phulka/i, minGrams: 25, maxGrams: 60 },
  { unitNamePattern: /idli/i, minGrams: 15, maxGrams: 40 },
  { unitNamePattern: /tsp|teaspoon/i, minGrams: 2, maxGrams: 8 },
  { unitNamePattern: /tbsp|tablespoon/i, minGrams: 8, maxGrams: 20 },
  { unitNamePattern: /^cup$/i, minGrams: 150, maxGrams: 260 },
];

export function servingPlausibility(
  unitName: string,
  grams: number,
  ranges: ServingPlausibilityRange[] = DEFAULT_SERVING_PLAUSIBILITY_RANGES,
): ValidationFlag[] {
  const match = ranges.find((range) => range.unitNamePattern.test(unitName));
  if (!match) {
    return [];
  }
  if (grams < match.minGrams || grams > match.maxGrams) {
    return [
      {
        rule: "serving_plausibility",
        severity: "warning",
        message: `"${unitName}" = ${grams}g is outside the plausible range [${match.minGrams}, ${match.maxGrams}]g`,
      },
    ];
  }
  return [];
}
