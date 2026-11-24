# Food Database Audit

Read-only audit of the food nutrition data behind `apps/api`'s `/food/*` endpoints: `public.*`
(the INDB/USDA-sourced tables from `0001_indb.sql`) plus `app.food_log`/`app.custom_food_ingredient`
rows that reference them. Produced by `db/audit-food-data.ts` (`pnpm audit:food`) against the real
local `indb` database, 2026-11-24. Nothing in this pass changed any data - see
`docs/FOOD_DATA_MIGRATION.md` for the backup taken before this audit ran.

Every number below is reproducible: re-run `pnpm audit:food` and compare `db/audit-output/summary.json`.
Raw per-row evidence is in the (gitignored) `db/audit-output/*.csv` files this audit produced.

## Inventory

| | count |
|---|---|
| Total foods | 1,346 |
| Recipes (INDB) | 1,014 |
| Ingredients (INDB + USDA) | 332 |
| `food_nutrient` rows | 48,606 |
| `recipe_ingredient` lines | 10,271 |
| `serving_measure` rows | 917 |
| `app.food_alias` rows | 31 |
| `app.food_log` rows (current) | 23 |
| `app.custom_food` / `app.packaged_food` | 2 / 2 |

### By the brief's 10 categories (`classifyFoodCategory`, `packages/shared/src/food-category.ts`)

| category | count |
|---|---|
| composite_indian_recipe | 616 |
| snack_beverage | 256 |
| international_recipe | 142 |
| raw_ingredient | 227 |
| fruit_vegetable | 55 |
| dairy | 33 |
| meat_poultry_fish | 11 |
| cooked_ingredient | 6 |
| packaged_branded | *(not in `public.*` - see `app.packaged_food`, 2 rows)* |
| restaurant | *(none - no restaurant-sourced data exists in this database)* |

This classifier is a best-effort word match for audit reporting only - it is not used anywhere in
the app and nothing in it gates search/diet filtering (that's `packages/shared/src/diet.ts`, a
different, already-shipped axis). Note how few ingredients classify as `cooked_ingredient` (6 out
of 332) - that's finding #5 below, not a sign that INDB mostly stores raw foods only.

## Findings

Severity: **critical** = produces a materially wrong (commonly >2×) kcal/macro value on a food a
real user is likely to log; **warning** = wrong or implausible but smaller, or affects a less
common food. Status: **V** = verified directly against the real database or source files in this
session; **H** = hypothesis from a handful of examples, later confirmed or narrowed by the audit
script's full pass (recorded under "Resolution" below).

### 1. Deep-frying oil/ghee recorded as the literal pan quantity, not what's actually absorbed — critical, V, 154 recipes

`db/audit-output/flags.csv`, rule `frying_oil_pan_quantity`: **154** recipes record an oil/ghee
(or INDB's generic placeholder names "Fat"/"Shortening" - see Resolution below) ingredient line at
a bulk pan quantity: either an explicit cup/`C` unit, or ≥100 ml/g. Confirmed directly against
`indb/data/raw/Units.xlsx` (INDB's own unit-conversion reference, read in this session): its
`Oil` row literally says `Frying: 2 cups` - INDB's source data itself treats "how much oil the pan
held" as the ingredient quantity, with no fat-absorption correction applied anywhere in the
pipeline.

Examples (current value → the magnitude of the problem, not yet a correction - see
`docs/FOOD_DATABASE_CORRECTIONS.md`):
- `BFP420` Chicken pakora/pakoda: `Oil` line is `240.0 ml`; current value 590 kcal/100g, 61g
  fat/100g.
- `ASC107` Poori: `Fat` line is `480.0 ml`; current value 738 kcal/100g, and (per the dry-run
  recalculation) would land near 87g fat/100g if only the water correction (#2) were applied
  without also fixing this - a concrete example of why these two findings can't be fixed
  independently of each other.
- `OSR119` Banana chips: `Oil` line is `2.0 C` (480 ml); current value 666 kcal/100g, 70.5g
  fat/100g.

**Resolution of the original H→V gap**: the first pass of this audit only matched ingredient
lines literally named "oil" or "ghee" in a cup/`C` unit, finding 31 recipes. Re-inspecting the
data directly surfaced two things that pass missed: (a) INDB uses generic placeholder names
**"Fat"** and **"Shortening"** for the same frying medium in many recipes (confirmed via
`food_external_ref`: their linked ingredient rows resolve to real butter/ghee/oil foods, not a
distinct ingredient), and (b) the pan-quantity pattern is also written in `ml`/`g` (not only
cup units) - `BFP420`'s 240 ml is an example. Broadening the detector to both found the true
scope: 154 recipes, not 31. `docs/NUTRITION_CALCULATION_METHODOLOGY.md` covers why this is not
corrected in this pass: it needs a cited fat-absorption factor that doesn't exist in this
database yet.

### 2. Cooking water/stock counted as edible weight — critical, V, 132 recipes

`flags.csv`, rule `cooking_water_weight_share`: **132** recipes have a `water`/`stock` ingredient
line making up more than 30% of the recipe's total recorded ingredient weight. Water itself
contributes ~0 kcal/macros, so counting it as part of the eaten weight dilutes every other
nutrient's per-100g value.

Verified examples:
- `ASC056` Boiled egg (Ubla anda): `Egg 50g` + `Water 100ml` → current 45 kcal/100g (a raw whole
  egg, `M001`, is 143 kcal/100g - the boiled-egg record should be close to that, not under
  half of it). The recipe's own default serving ("1 egg") is recorded as **151 g** - more than
  double a real egg's weight, because it's `egg + its boiling water`.
- `ASC096` Chapati/Roti: `Whole wheat flour 80g` + `Water 4 tbsp (60g)` + `Ghee or butter 1 tsp` →
  current 202 kcal/100g, which is actually closer to correct for an already-cooked chapati
  because dough water largely stays *in* the final bread (unlike boiling water, which is drained
  or evaporates away from the egg/pasta/rice it surrounded) - see the caution below.

**A real trap this audit's own dry run caught, worth recording explicitly**: a blanket "exclude
every water/stock ingredient line" rule is *wrong* for beverages and soups, where the water **is**
the food, not a discarded cooking medium. `db/recalc-recipes.ts`'s first pass, before this guard
was added, computed "Hot tea (Garam Chai)" at 102.6 kcal/100g by excluding its water - a tea-bag
amount of calories concentrated into a cup's worth of liquid is not a real correction, it's a unit
error in the opposite direction. The fix: recipes classified `snack_beverage` or
`international_recipe` (which also catches soups/stews, see `food-category.ts`) are reported
**unresolved**, not auto-corrected - see `docs/FOOD_DATABASE_CORRECTIONS.md`.

### 3. Energy inconsistent with stated macros — critical/warning, V, 174 foods

`flags.csv`, rule `energy_consistency` (Atwater-general cross-check, `packages/shared/src/nutrition-validation.ts`,
15% tolerance): **174** foods (recipes and ingredients) have a stated kcal value that materially
disagrees with 4×protein + 9×fat + 4×carb + 2×fibre computed from their own macros. This overlaps
heavily with findings #1 and #2 (diluted water weight and uncorrected frying oil both break the
kcal/macro relationship in different directions) rather than being a fully independent root
cause - e.g. `ASC080` Lentil soup: stated 31 kcal/100g vs. an Atwater estimate of 165 kcal/100g
(428% deviation), driven by its `Vegetable stock or water 1 C` line.

### 4. Serving-measure gram weights inherit findings #1/#2 — warning, V, 32 servings

`flags.csv`, rule `serving_plausibility`: **32** `serving_measure` rows fall outside a conservative
plausible-weight range for their unit name (e.g. an "egg" serving should weigh 35-70g). Root
cause confirmed directly in `indb/load.py:128`: serving grams are derived as
`per_serving / per_100g * 100`, which mechanically inherits whatever distortion findings #1/#2
put into `per_100g`. `ASC056`'s "egg" serving = **151g** is the clearest example (it's the whole
boiled-egg-plus-water recipe, not one egg).

### 5. Search aliases surface raw/dry ingredients with no "raw" label — warning, V, 31 of 31 aliases

All 31 rows in `app.food_alias` (`db/data/food-alias.csv`) point at a plain ingredient, and none
of those 332 ingredients carry a "raw"/"cooked" word in their name except the 6 that classify as
`cooked_ingredient` above. A user typing "rice" or "chawal" is matched to `A014` "Rice, parboiled,
milled" at 374 kcal/100g (a dry, uncooked weight) - cooked rice is closer to 130 kcal/100g for the
same 100g. The same pattern applies to "moong dal", "rajma", "chana", "urad", "masoor" (all point
to the raw/dry pulse) and "chicken"/"murga"/"murgh" (→ raw chicken breast). This is a
search/UX problem on top of a data problem: INDB simply has very few cooked-ingredient records at
all (6 of 332) to alias to instead.

### 6. 26 ingredients have no nutrient values at all — warning, V, 142 missing core-nutrient values

`flags.csv`, rule `missing_core_nutrient`: 26 ingredients are missing energy/protein/fat/carb
entirely (104 missing values) plus 12 more missing only fibre (38 missing values total for
fibre specifically) = **142** missing core-nutrient values. Per `indb/README.md`'s own
documentation, these 26 have no USDA match and IFCT 2017 isn't licensed for this project (see
`docs/NUTRITION_DATA_SOURCES.md`): **paneer (`L003`)**, khoya, ragi, poha, horse gram, amla, curry
leaves, methi leaves, asafoetida, garam masala, tinda, sweet lime, wood apple, among others.
Confirmed null (not silently zero) directly in `food_nutrient` and in `FoodService`/`FoodLogService`
code - neither treats a null as 0, but the recipes that use these ingredients (e.g. any paneer
dish via `app.food_alias`'s `paneer → L003` row) simply can't resolve full macros today.

### 7. USDA ingredient matches of lower confidence — info/warning, V, 53 ingredients

`food_external_ref.match`: 253 exact, **35 close**, **18 proxy** (e.g. rohu→carp, jaggery→brown
sugar, pomfret→butterfish, green mango→mango). Already documented in `indb/README.md`; this audit
just confirms the count and lists every one in `db/audit-output/usda_mapping_quality.csv` for a
human reviewer to spot-check in Phase 2.

### 8. App code treats a missing ingredient nutrient as contributing 0 — critical, V — **labeling fixed in Phase 5**

`apps/api/src/food-log/food-log.service.ts`'s `computeCustomFoodMacrosPerGram` (lines ~113-126):
when a custom-food ingredient's `summary` lookup misses, the `?? 0` fallback means that ingredient
contributes literally nothing to kcal/protein/fat/carb **while its grams still count toward
`totalGrams`** - silently diluting, not excluding, the custom food's macros. Combined with finding
#6 (paneer has no nutrients at all), logging a custom "Paneer butter masala" recipe today would
silently undercount its protein and fat, with no flag anywhere that this happened. This is the
exact anti-pattern `packages/shared/src/recipe-calc.ts`'s engine (built in this pass) was designed
never to do - see its `missingNutrientIngredients` field.

**Phase 5 fix** (`docs/FOOD_DATA_MIGRATION.md` section 2.4): the function (renamed
`computeCustomFoodMacros`) now tags its result `estimated` instead of `calculated` whenever at
least one ingredient's nutrients couldn't be resolved, stored in the log's
`nutrition_confidence`. The arithmetic itself is unchanged - a missing ingredient's weight still
counts toward the total exactly as before, since this pass's scope is honest labeling, not a
numeric correction. Verified via a dedicated unit test (mixed resolvable/unresolvable ingredients
tags `estimated`; a fully-resolved recipe tags `calculated`).

### 9. App code treats `ml` the same as `g` for custom/packaged foods — warning, V — **still open**

`food-log.service.ts`'s `resolveGrams`/the packaged-food branch both treat quantity as grams
regardless of whether the logged unit was `g` or `ml` (e.g. oil, milk) - a documented v1
simplification already called out in `CLAUDE.md`, not a new discovery, but recorded here because
it compounds findings #1/#2 for any oil/liquid ingredient a user logs directly. **Deliberately not
touched in Phase 5**: a correct fix needs a per-ingredient density lookup that doesn't exist yet;
even flagging it as lower-confidence without that data would itself be a guess
(`docs/FOOD_DATA_MIGRATION.md` section 2.4).

### 10. No server-side nutrient snapshot on `app.food_log` — critical for migration safety, V — **fixed in Phase 5**

Every read (`FoodLogService.listByDate`, the `/sync` pull path) re-derives macros from the
*current* state of `public.*`/`app.custom_food*`/`app.packaged_food` via `enrichWithMacros` - there
is no stored kcal/macro value on the `food_log` row itself. This means correcting the underlying
data would **silently rewrite every historical log's displayed macros** the next time it's read,
with no record that a change happened.

**Phase 5 fix** (`docs/FOOD_DATA_MIGRATION.md` section 2.3): `app.food_log` now has
`kcal_snapshot`/`protein_g_snapshot`/`fat_g_snapshot`/`carb_g_snapshot`/`nutrition_confidence`/
`nutrition_version` columns, populated at write time by `FoodLogService.create`/`update` and by
`SyncService.push`'s food_log handling (the real mobile write path), and backfilled once for all
23 pre-existing rows. `enrichWithMacros` now returns the stored snapshot whenever one exists,
falling back to live computation only when it doesn't - verified both by unit test and by a live
smoke test against the real database and a running server.

### 11. Open Food Facts values carry no "unverified" label — warning, V — **fixed in Phase 5**

`packaged-food.service.ts`'s `lookupByBarcode` stores OFF's crowdsourced `nutriments` values with
no confidence/provenance column distinguishing them from a manufacturer-label entry. Brief
section 2/10 is explicit that crowdsourced data must not be presented as verified fact.

**Phase 5 fix**: `app.packaged_food` now has a `confidence` column, defaulting `unverified`
(confirmed: both pre-existing rows defaulted correctly). `PackagedFoodService.getNutrientSummaries`
surfaces it, and `enrichWithMacros` carries it into a packaged-food log's `nutrition_confidence`
snapshot - **not yet surfaced in the mobile UI** (no badge exists anywhere in the app yet; see
`docs/FOOD_DATA_MIGRATION.md` section 2.5).

## Duplicates

`db/audit-output/duplicates.csv`: **11** same-food-type name pairs at ≥0.80 trigram similarity.
Spot-checked by hand - these read as genuinely **distinct dishes with similar names**, not
data-entry duplicates (e.g. `ASC027`/`ASC040` "Cheese and tomato sandwich" vs. "...(toasted)";
`BFP346`/`BFP347` "Vanilla ice cream without egg" vs. "...with egg"). Listed for a human reviewer
to confirm in Phase 2 - none should be auto-merged.

## App-side impact today

`db/audit-output/app_side_null_kcal_refs.csv`: **0** current `app.food_log`/`app.custom_food_ingredient`
rows reference a food with a null kcal value - the current 23 logged entries happen not to hit
finding #6's gap yet. This will change the moment a real user logs paneer, khoya, or any of the
other 24 affected ingredients - findings #6 and #8 compound at that point.

## Phase 2 update: INDB's own methodology paper confirms findings #1/#2 directly

A second pass of this audit confirmed outbound network access does work in this environment (the
original "not reachable" note below was a sandboxed-shell DNS restriction, not a true absence of
connectivity) and fetched INDB's published methodology paper directly: Vijayakumar A, Dubasi HB,
Awasthi A, Jaacks LM. *Development of an Indian Food Composition Database.* Current Developments
in Nutrition, 8(7):103790, 2024 (open access, CC BY 4.0, `https://pmc.ncbi.nlm.nih.gov/articles/PMC11277795/`).
Its own stated method: *"The nutrient content of all ingredients in a recipe was summed to obtain
the total nutrient content per 100 g of the recipe and per serving"* - directly confirming findings
#1 and #2 are not an artifact of this project's load pipeline but INDB's own documented approach:
every recipe's weight is the literal sum of its recorded ingredient quantities, with no yield or
absorption adjustment in the primary calculation. The paper does describe a sensitivity analysis
against the USDA Nutrient Retention Factors table, but it matched only 42.62% of ingredients, and
(per `docs/NUTRITION_DATA_SOURCES.md`) that table covers vitamins/minerals only, never kcal or
macros - so it would not have corrected the values this audit is about even where it did match.
See `docs/NUTRITION_DATA_SOURCES.md` for the full citation, the real USDA cooking-yield/retention
documents now fetched and verified, and a directly-verified real/cooked egg pair (USDA FDC
171287→173424, 143→155 kcal/100g) that closes part of finding #2/#5 for eggs specifically.

## What this audit still does not cover (open items)

- No fat-absorption factor for frying has been sourced yet - the one candidate primary source
  found (a Culinary Science & Technology journal article) is paywalled, so only a secondhand
  summary exists, which isn't citable as verified. This still blocks any real correction to
  finding #1 (154 recipes). See `docs/NUTRITION_DATA_SOURCES.md`.
- USDA SR Legacy raw/cooked FDC ID pairs for the specific pulses/grains behind most of the 132
  water-share recipes (rice, dal varieties, wheat) were not individually looked up in this pass -
  a mechanical follow-up, not a blocked one (the egg pair above shows the approach works).
- Whether to pursue IFCT 2017 permission (would close finding #6 for several Indian-specific
  ingredients) is still open. Two independent signals now point the same way: the HealthifyMe
  teardown (cited in the approved plan) reports their own Indian database was built "in
  collaboration with" NIN, and INDB's own paper states its ingredient data was "primarily derived
  from" IFCT 2017 - suggesting a working relationship with NIN is realistic, not a dead end,
  though neither source documents NIN's explicit consent to that specific reuse.
