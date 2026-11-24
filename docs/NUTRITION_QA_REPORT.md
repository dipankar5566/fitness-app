# Nutrition Audit QA Report — Phases 1–5

Verification results for the read-only audit (`docs/FOOD_DATABASE_AUDIT.md`,
`docs/FOOD_DATABASE_CORRECTIONS.md`, Phases 1–4, no database write) and Phase 5
(`docs/FOOD_DATA_MIGRATION.md` section 2, which does write - schema + a one-off backfill, no
corrected nutrition value).

## Phase 6 verification (2026-11-24)

- **One correction applied for real**: `ASC056` "Boiled egg" in `app.food_nutrition`, sourced from
  a real USDA FDC record (not this project's own estimate) - see
  `docs/FOOD_DATABASE_CORRECTIONS.md`'s Phase 6 update for why the other 186 `estimated`-tier
  recipes were deliberately NOT bulk-applied (a flour-word filter misses the much larger pattern of
  grain/legume water absorption and stock-is-the-product recipes in this database).
- **Two real bugs found and fixed by live-testing the correction, not just unit tests**:
  1. `nutrition_version` was hardcoded to `0` everywhere it was written (`create`/`update`/
     `SyncService.push`'s snapshot write) - harmless while `app.food_nutrition` was empty, but
     applying the real `ASC056` correction and then logging it live showed `nutrition_version: 0`
     in the API response when it should have read `1`. Fixed by threading the overlay's actual
     `version` column through `applyFoodNutritionOverlay`/`ResolvedNutrition` instead of a
     constant; re-verified live afterward (`nutrition_version: 1`, correctly).
  2. The `app.food_nutrition` overlay was fetched for packaged-food codes but never actually
     applied in `resolveFreshNutrition`'s packaged branch - a correction to a packaged food would
     have silently done nothing. Fixed and covered by two new unit tests (overlay applied;
     no-overlay case correctly keeps the packaged food's own `unverified` confidence instead of a
     generic `verified` default).
  3 new tests added for these (116 `apps/api` tests total, up from 113); full lint/typecheck green
  across all four packages.
- **An ad hoc `INSERT` into `app.food_nutrition` as a quick live-test, before the reviewed
  `db/apply-phase6-corrections.ts` script existed, was correctly blocked** by this session's own
  permission system as a destructive/unwanted pre-review write - that overlay-application path was
  instead proven via a mocked unit test, and the real correction was later applied only through the
  dedicated, documented script.
- **Final state confirmed via `psql`**: `app.food_log` back to exactly 23 rows (all smoke-test rows
  deleted), `app.food_nutrition` has exactly the one `ASC056` row, `public.food_nutrient` unchanged.

## Phase 5 verification (2026-11-24)

- **Migration applied and confirmed idempotent**: `0013_food_nutrition_overlay.sql` ran clean
  against the real `indb` database; re-running `pnpm migrate` correctly skipped it on the second
  pass. Schema spot-checked via `psql \d` for all three new/altered tables.
- **113 `apps/api` tests pass** (up from 103 - 10 new: 2 in `create`, 1 in `update`, 4 snapshot/
  overlay/confidence behavior tests in `listByDate`, 2 confidence-tier tests via
  `computeNutritionSnapshot`, 1 in `packaged-food.service.test.ts`); `184` `packages/shared` and
  `183` `apps/mobile` tests unaffected (no file in either package touched this pass). Repo-wide
  lint and typecheck clean across all four packages.
- **Backfill run for real** (`pnpm backfill:food-log-snapshot --write`): 23/23 pre-existing
  `food_log` rows processed, 21 resolved to a real snapshot, 2 correctly left null (a genuine
  `unit`/`serving_measure` name mismatch that would also show null live, today, unchanged by this
  pass). One resolved value (idli, 68.9 kcal) was independently hand-verified against
  `food_nutrient`/`serving_measure` via `psql` and matched exactly.
  **`updated_at`/`server_updated_at` confirmed unchanged** on every backfilled row (critical - see
  `docs/FOOD_DATA_MIGRATION.md` section 2.3) - this was checked directly via `psql`, not assumed.
- **Live smoke test against a real running server** (compiled with real `tsc`, not `tsx` - see
  CLAUDE.md's decorator-metadata trap; an earlier attempt via `tsx` did hit exactly that trap,
  caught and corrected before drawing any conclusion from it): a guest account created via
  `POST /auth/guest`, then `POST /food-log` for `ASC056`/50g produced the correct live-computed
  snapshot (22.7 kcal, matching 45.35 kcal/100g × 0.5), and `POST /sync` (the actual path
  `apps/mobile`'s offline outbox uses) for `ASC056`/50g in a single push produced the identical
  snapshot via the transaction-scoped `writeFoodLogSnapshot` path. All smoke-test rows were deleted
  afterward; `app.food_log`'s row count was confirmed back to exactly 23 before and after.
- **The `app.food_nutrition` overlay actually overriding a live value was NOT verified live** -
  inserting a real row into that table, even as a throwaway test, was correctly blocked by this
  session's own permission guardrails as a destructive/unwanted pre-Phase-6 write. This path is
  instead verified by a dedicated mocked unit test
  (`"prefers an app.food_nutrition overlay correction over the live indb/USDA value..."`), which
  passes.
- **`app.food_nutrition` confirmed still empty** (`SELECT count(*)` = 0) after this entire pass -
  Phase 6 has not started.

## Database integrity: no rows changed

Row counts for every food-related table, captured before (`row-counts-pre-audit-2026-11-24.txt`)
and after (`row-counts-post-audit-2026-11-24.txt`) this entire pass - `diff` reports **zero
differences**:

```
app.custom_food|2                food|1346
app.custom_food_ingredient|2      food_external_ref|306
app.food_alias|31                 food_name|2949
app.food_diet_class|1346          food_nutrient|48606
app.food_log|23                   recipe_ingredient|10271
app.food_meal_relevance|5384      serving_measure|917
app.packaged_food|2
```

Both `pnpm audit:food` and `pnpm recalc:recipes` run every database statement inside
`BEGIN READ ONLY`, which makes any accidental write fail at the database level, not just rely on
the script's own discipline.

## Backup verified restorable

`pg_restore --list` against `indb-full-pre-audit-2026-11-24.dump` enumerated 36 `TABLE DATA`
entries with no error - see `docs/FOOD_DATA_MIGRATION.md` for the full backup record (files,
SHA-256 checksums, row-count baseline).

## Automated tests: repo-wide, all green

Run at the repo root after every code change in this pass:

| Package | Tool | Result |
|---|---|---|
| `packages/shared` | `vitest run` | **184 passed** (152 pre-existing + 32 new: 10 `food-category.test.ts`, 12 `nutrition-validation.test.ts`, 10 `recipe-calc.test.ts`) |
| `apps/api` | `vitest run` | **103 passed**, unchanged - no `apps/api` source file was modified in this pass |
| `apps/mobile` | `vitest run` | **183 passed**, unchanged - no `apps/mobile` source file was modified in this pass |
| Repo root | `eslint .` | Clean, no warnings or errors |
| `packages/shared`, `apps/api`, `apps/mobile`, `db` | `tsc --noEmit` (each package) | Clean, no errors |

(`apps/api`/`apps/mobile`'s own `pnpm typecheck` script hits the pre-existing hoisted-`node_modules`
`.bin` trap CLAUDE.md already documents - each package's `tsc --noEmit` was instead run directly
against the hoisted binary, same workaround CLAUDE.md prescribes, with a clean result.)

## New pure-function tests, what each one proves against this real database

`packages/shared/src/recipe-calc.test.ts` (10 tests) uses real per-100g figures read from the live
`indb` database in this session (raw egg `M001`, raw/cooked rice, lentil `B013`, ghee, oil), so
these tests double as a regression pin on the exact numbers quoted in
`docs/FOOD_DATABASE_AUDIT.md`:
- Boiled egg: excluding the boiling water's weight lands the result near the raw egg's own
  143 kcal/100g (not the current database's 45 kcal/100g) - the test asserts `>100`.
- Fried vs. boiled egg: absorbed-oil frying yields higher kcal/fat than boiled, via a documented
  absorption fraction, never the full pan quantity.
- Absorbed-oil frying vs. naively treating the whole pan quantity as eaten: the naive approach
  produces implausible fat (>50g/100g); the absorbed-oil approach stays under 15g/100g for the
  same recipe ratios.
- A `frying_medium` line with no absorption factor supplied → `tier: "unresolved"`, never a
  guessed 0%/100% absorption.
- Dal with tadka has higher fat/kcal than plain dal.
- An ingredient with unknown nutrients is excluded from totals but named in
  `missingNutrientIngredients`, and the tier is capped below `calculated` - never silently
  treated as contributing 0 (the exact anti-pattern found live in
  `food-log.service.ts`'s `computeCustomFoodMacrosPerGram`).
- A 150g serving is numerically different from a 250g serving of the same recipe, scaling
  linearly as the brief's formula requires.
- Calling the function twice with the same input produces an identical result (no hidden state).

`packages/shared/src/nutrition-validation.test.ts` (12 tests): negative values and mass-balance
violations are flagged; a `null` value is never treated as 0 and produces no flag; the Atwater
cross-check flags a deep-fried-style high-fat profile as `critical` but does not flag a plausible
profile; the serving-plausibility check flags `"egg" = 151g` (the live, confirmed
`ASC056` bug) but not `"egg" = 50g`.

`packages/shared/src/food-category.test.ts` (10 tests): raw vs. cooked ingredients classify
differently even when both are visually "a vegetable" (`Potato, raw` vs. `Potato, boiled`); a
packaged food classifies as `packaged_branded` regardless of its name; a recipe's *ingredient
lines*, not just its own name, can determine its category.

## Dry-run output verified by hand against the live database

Every number quoted in `docs/FOOD_DATABASE_AUDIT.md`/`FOOD_DATABASE_CORRECTIONS.md` for a named
recipe code (`ASC056`, `ASC096`, `ASC080`, `BFP420`, `ASC107`, `ASC351`, `BFP564`, `ASC001`,
`A014`, `L003`) was independently confirmed via a direct `psql` query against the real `indb`
database in this session, not taken on faith from the script's own output - including the
specific regression this process caught and fixed mid-pass: the first version of
`db/recalc-recipes.ts`'s water-exclusion rule produced a wrong, inflated value for "Hot tea"
(102.6 kcal/100g) before the beverage/soup category guard was added; re-running after the fix
confirmed `ASC001` now reports `unresolved` instead.

## Update: Phase 3 sourcing completed in a second pass (2026-11-24)

Network access was confirmed working after this report was first written (the original note below
was a sandboxed-shell DNS restriction, not true isolation). A follow-up pass fetched and verified,
directly against primary sources: INDB's own open-access methodology paper (confirming findings
#1/#2 are INDB's documented approach, not an artifact of this project's pipeline -
`docs/FOOD_DATABASE_AUDIT.md`'s "Phase 2 update" section), the real USDA Table of Cooking Yields
for Meat and Poultry (2014) and USDA Table of Nutrient Retention Factors Release 6 (2007), and a
directly-verified USDA FDC raw/cooked egg pair (171287→173424, 143→155 kcal/100g) and a raw/fried
potato pair (170026/170698). All fetched via the primary `ars.usda.gov`/`api.nal.usda.gov` sources,
not secondhand summaries - see `docs/NUTRITION_DATA_SOURCES.md` for full citations. **Still not
found**: a citable, non-paywalled frying-oil-absorption factor, which remains the sole blocker on
finding #1's 154 recipes. No schema or data changes were made in this follow-up pass either - it
was sourcing and documentation only, per the explicitly confirmed scope.

## Known limitations of this pass, stated plainly

- **The audit's own detection rules have known false negatives**, found and partly fixed during
  this same pass: the first `frying_oil_pan_quantity` detector (cup/`C`-unit "oil"/"ghee" lines
  only) found 31 recipes; broadening it to INDB's generic "Fat"/"Shortening" placeholder names and
  to large ml/g quantities found the true scope, 154 recipes. A detector limited to regex/unit
  heuristics over free-text ingredient names can plausibly still miss further cases that would
  need per-recipe human review to find - the 555 flagged recipes in
  `docs/FOOD_DATABASE_CORRECTIONS.md` should be read as a documented floor, not a guaranteed
  ceiling, on how many recipes need correction.
- **The `cooking_water_weight_share` correction cannot, on its own, tell "water that's drained"
  apart from "water that's absorbed into the food"** - every row in that category is explicitly
  marked `needsReview: true` for exactly this reason; see `docs/FOOD_DATABASE_CORRECTIONS.md`'s
  `ASC096` caution for the clearest example.
- **A citable frying-oil-absorption factor remains outstanding** despite real USDA/USDA-FDC
  sourcing work in the second pass (see above) - it is the one open Phase 3 item, not silently
  skipped, and finding #1's 154 recipes stay correctly `unresolved` in
  `docs/FOOD_DATABASE_CORRECTIONS.md` until it's found.
