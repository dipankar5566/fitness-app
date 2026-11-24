# Nutrition Calculation Methodology

How this project computes and validates nutrition values. Companion to
`docs/FOOD_DATABASE_AUDIT.md` (what's wrong) and `docs/NUTRITION_DATA_SOURCES.md` (what sources
back a value). The engine and rules described here are implemented and unit-tested in
`packages/shared/src/recipe-calc.ts` and `packages/shared/src/nutrition-validation.ts`.

## Standard basis

Every nutrient value is per 100g of edible portion, matching `public.food_nutrient.per_100g`'s
existing convention - no change needed here, this project already follows it. Energy is always
displayed in **kcal**, never cal (CLAUDE.md/brief section 4) - `nutrient.code = 'energy_kcal'`,
unit `'kcal'`, already correctly distinct from the unused `'energy_kj'` row.

## Energy calculation

- **A source-specific stated kcal value is always preferred** over a generic calculation - this
  project never blanket-replaces a sourced energy value with 4-4-9 math.
- **The Atwater-general cross-check** (`energyConsistency` in `nutrition-validation.ts`): 4
  kcal/g protein, 9 kcal/g fat, 4 kcal/g carbohydrate, plus 2 kcal/g dietary fibre (the commonly
  used "general" fibre convention). This is **only a plausibility flag**, never a replacement
  value - the function returns flags, not a corrected number, and a food can legitimately deviate
  (organic acids, a different fibre convention, alcohol) without being wrong.
- **When energy must be estimated from a recalculated recipe** (`calculateRecipeNutrition` in
  `recipe-calc.ts`): computed directly from each contributing ingredient's own sourced kcal, not
  from a blanket 4-4-9 reconstruction of the whole dish - the brief is explicit that this is the
  preferred approach ("prefer a documented source-specific kcal value... if energy must be
  estimated from macronutrients, use a documented and appropriate energy-factor methodology").
  The result is always tagged `calculated` or `estimated` (see confidence tiers below), never
  presented as a directly sourced value.

## Recipe calculation formula

Per ingredient, for each nutrient:

```
contribution = (ingredient grams / 100) × per-100g value × retention factor
```

`retention factor` defaults to "not documented" (not silently 1.0) - `recipe-calc.ts`'s
`RecipeIngredientLine.retentionFactor` is optional, and its absence caps the whole recipe's
confidence tier at `estimated`, never `calculated` (see below). This is deliberate: assuming "no
nutrient loss during cooking" by default would itself be an unsourced claim.

Each ingredient line has a **role**, assigned by a human or script reviewer, never guessed inside
the pure calculation itself:

- **`contributing`** - eaten as part of the final dish; its full weight and (role-appropriate)
  nutrients count.
- **`frying_medium`** - the oil/ghee/fat a food is fried in. Only a documented
  `FryingAbsorptionFactor.absorptionFraction` of its *stated pan quantity* counts toward the
  final dish's weight and nutrients - never the full pan quantity (finding #1). A recipe with a
  `frying_medium` line and no supplied factor is reported `unresolved`, not guessed at 0% or
  100% absorption.
- **`excluded_cooking_medium`** - a cooking medium not eaten with the dish (boiling water that's
  drained, pasta water). Its weight and nutrients are excluded entirely (finding #2). **This role
  must never be applied to a beverage or soup/stew**, where the water or stock *is* the food -
  `db/recalc-recipes.ts`'s own dry run caught exactly this mistake on "Hot tea" before the guard
  was added (see `docs/FOOD_DATABASE_AUDIT.md` finding #2) and now reports those recipes
  `unresolved` for a human reviewer instead.

Final weight:

```
final cooked weight = Σ(contributing grams) + Σ(frying_medium grams × absorptionFraction)
```

Per-100g and per-serving values then follow the brief's own formulas directly:

```
nutrient per 100g       = (total recipe nutrient value / final cooked weight) × 100
nutrient per serving    = (total recipe nutrient value / final cooked weight) × serving weight
```

(`scaleToServing` in `recipe-calc.ts` implements the second line exactly - verified by a test
asserting a 150g serving is not the same as a 250g serving of the same recipe.)

**Water/oil/cooking ingredients are never double-counted**: `excluded_cooking_medium` grams never
enter the final-weight sum at all, and `frying_medium` grams enter only at their absorbed
fraction, once.

## Unit → gram conversion

Ingredient quantities are converted to grams only via a documented source - `indb/data/raw/Units.xlsx`
(INDB's own household-unit reference, e.g. `1 C = 240ml`, `1 tbsp = 15g` for a butter-density
ingredient). A unit this table doesn't cover makes that ingredient line - and therefore the whole
recipe - **unresolved**, rather than guessed. `db/recalc-recipes.ts`'s dry run hit this for
`ASC080` Lentil soup (a `sprig` of coriander has no documented gram weight) and correctly
reported it `unresolved` instead of silently dropping the sprig's weight.

## Raw vs. cooked accuracy

This project's existing data model already keeps raw and cooked foods as **separate records**
(distinct `food.code` rows) rather than one row with a mutable state - no schema change needed
for this. The problem `docs/FOOD_DATABASE_AUDIT.md` finding #5 identifies is coverage, not
structure: only 6 of 332 ingredients currently have an explicit cooked-state record at all, so
most everyday "cooked X" lookups have nothing to alias to. Closing that gap means **adding** new
cooked-state ingredient records sourced from USDA (which does have many raw/cooked pairs, e.g.
"Rice, white, long-grain, regular, cooked"), not converting existing raw records in place.

No fixed raw→cooked conversion ratio (e.g. "rice always triples in weight") is applied anywhere
in this methodology without a per-ingredient documented source, per the brief's explicit rule.

## Serving and portion policy

- A serving/portion is only ever derived from a documented source (currently `serving_measure.grams`,
  itself derived by `indb/load.py` from INDB's own per-serving values) or explicitly labelled as
  an estimate.
- **Grams are always an available entry option** - no screen should force a user through an
  ambiguous unit with no gram equivalent (`apps/mobile`'s existing `LogFoodScreen`/
  `LogPackagedFoodScreen` already support direct gram entry; no change found needed here).
- No unit name ("bowl", "cup", "tablespoon") is assumed to have one universal weight across
  foods - `serving_measure` already varies per food (e.g. `ASC080`'s "soup bowl" = 389g vs.
  `ASC240`'s Chicken curry "bowl" = 248g), which is correct; `servingPlausibility`
  (`nutrition-validation.ts`) only flags a specific food's serving weight as implausible for its
  *own* unit name, never compares across foods.

## Confidence tiers

| Tier | Meaning | Who/what can produce it |
|---|---|---|
| **verified** | From a documented, licensed composition reference (INDB/USDA as stored) or a manually captured manufacturer label. | Direct database value; a human-entered label capture |
| **calculated** | Computed from verified ingredients via this methodology, with every retention/absorption factor documented and every ingredient's nutrients known. | `calculateRecipeNutrition` only when `missingNutrientIngredients` is empty AND every line has an explicit `retentionFactor` |
| **estimated** | Computed with at least one undocumented retention assumption, a missing-but-excluded ingredient, or a recognized-but-unresolved classification gap. | `calculateRecipeNutrition` whenever either gap applies - this is the tier nearly every recipe in the Phase 4 dry run gets, honestly, because no retention factors are documented yet |
| **unverified** | No sufficiently documented source at all. | A food with no nutrient row; an Open Food Facts value not yet confirmed against a real label |

An `estimated` or `unverified` value must never be displayed to a user as if it were `verified` -
this is the direct implementation of brief section 10/15's confidence-system requirement. The
proposed app-side change (not yet built - see `docs/FOOD_DATA_MIGRATION.md`) is a `confidence`
column alongside the proposed nutrient-snapshot columns on `app.food_log`, surfaced in the UI as a
small badge, the same visual language `apps/mobile` already uses for `isEstimate` on an AI-parsed
meal item.

## Validation rules (implemented, non-mutating)

`packages/shared/src/nutrition-validation.ts`, used today by `db/audit-food-data.ts` and intended
to be reused unchanged by any future data-load or CI gate:

- `validateNutrientProfile` - negative values; protein+fat+carb exceeding ~100g per 100g edible
  portion (mass balance, with a 2g rounding tolerance).
- `energyConsistency` - the Atwater cross-check described above, with a tunable tolerance
  (15% warning, >30% critical in the audit's own configuration).
- `servingPlausibility` - a conservative gram-range check per common unit name.

All three only ever return flags (`ValidationFlag[]`) - none of them mutate, clamp, or zero a
value, matching the brief's "do not automatically modify suspicious values; flag them for review"
rule exactly.
