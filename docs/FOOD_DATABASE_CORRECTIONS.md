# Food Database Corrections

## Phase 6 update (2026-11-24): one correction applied, the rest deliberately not

Reviewing this file's proposed `estimated`-tier batch for actual application (`go-ahead`d
separately from Phases 1–5) surfaced a problem with the whole category, not just `ASC096`'s
already-flagged dough caution below: **excluding every flagged recipe's `water`/`stock` ingredient
is wrong for most of this list even after removing beverages/soups**. Classifying the 187
`estimated`-tier recipes by whether they contain a flour/dough word (`flour`/`maida`/`atta`/
`besan`/`suji`/etc.) found only 57 with that word - but the other 130 are overwhelmingly dal,
pulao, khichdi, kheer, porridge, rice, **stock**, squash, jam, and pickle recipes. In every one of
these, the water is either absorbed into a grain/pulse (the exact same physical reality as dough,
just missing the word "flour"), **is the finished product** (a stock's whole point is the liquid;
excluding it and counting only the discarded bones/vegetables would be backwards), or is a
preservation medium (jam, pickle) - never a simple boiled-and-discarded medium the way a boiled
egg's water is. A flour-word filter catches dough but completely misses this larger pattern.

**Conclusion**: reliably telling "this water is really discarded" apart from "this water is
absorbed or is the product" for this food database needs real culinary/nutrition review per
recipe, not a word-based heuristic - exactly the "review uncertain mappings... obtain approval
before destructive updates" step the audit brief's own rules require before a write like this.
**Only `ASC056` "Boiled egg" was applied** (`db/apply-phase6-corrections.ts --write`), because it's
the one case in this entire file with a genuinely `verified`-tier source: USDA FDC 173424 ("Egg,
whole, cooked, hard-boiled", SR Legacy, CC0) = 155 kcal, 12.58g protein, 10.61g fat, 1.12g carb per
100g - not this project's own recalculation, a real directly-measured record. Verified live against
the real database: `app.food_nutrition` now has exactly this one row; `public.food_nutrient`'s
`ASC056` value is unchanged (still 45.35, confirming `public.*` stays read-only); three pre-existing
`food_log` rows that reference `ASC056` kept their own frozen snapshot values (205.5/137/36.3 kcal,
from before the correction) and a freshly-logged `ASC056` entry correctly picked up the new 155
kcal/100g value, `nutrition_confidence: "verified"`, `nutrition_version: 1`.

**The other 554 flagged recipes below remain exactly as proposed - a reference for a future pass
with real domain review, not something to bulk-apply from this file as-is.**

---

This is a **review document**, not a change log for anything beyond `ASC056` above - nothing else
in `public.*` or `app.*` has been modified. Every number here comes from `db/recalc-recipes.ts`'s
dry run (`db/audit-output/proposed_corrections.csv`), run against the real `indb` database on
2026-11-24
with no `--write`-equivalent mode even existing yet (the script only ever opens a
`BEGIN READ ONLY` transaction). Re-run with `pnpm recalc:recipes` to regenerate.

Companion to `docs/FOOD_DATABASE_AUDIT.md` (what's wrong and why) and
`docs/NUTRITION_CALCULATION_METHODOLOGY.md` (the formula used).

## Summary

| Confidence tier | Recipe count |
|---|---|
| `estimated` | 187 |
| `unresolved` | 368 |
| **Total flagged** | 555 |

No row is `calculated` or `verified` - correctly so, per the methodology doc: every proposed value
here either excludes an undocumented cooking medium (capped at `estimated`) or has no documented
factor to resolve it at all (`unresolved`).

## Resolved category: cooking-water weight share, excluding a drained medium (estimated tier)

For a `cooking_water_weight_share`-flagged recipe that is **not** a beverage/soup (see the
exclusion rule below), the dry run excludes its matched `water`/`stock` ingredient line(s) from
the final weight and recomputes per-100g values from the remaining ingredients' own sourced
nutrients. No retention factor is applied (none is documented yet), which is exactly why these
land at `estimated`, never `calculated`.

Verified-by-hand examples (cross-checked against the live database in this session):

| Code | Name | Current kcal/100g | Proposed kcal/100g | Notes |
|---|---|---|---|---|
| `ASC056` | Boiled egg (Ubla anda) | 45.4 | **142.2** | Close to raw egg `M001`'s 143 kcal/100g, as expected once the boiling water is excluded |
| `ASC096` | Chapati/Roti | 202.3 | **371.5** | Dough water is genuinely part of the final bread's weight in reality - this proposed value needs Phase 5/6 human review before use, see the caution below |
| `BFP420` | Chicken pakora/pakoda | 590.1 | **632.3** | Missing nutrient data for 2 ingredients (dry fenugreek leaves, garam masala) - proposed value is still an underestimate |

**Caution, stated plainly for whoever reviews this next**: `ASC096`'s proposed value is *not*
necessarily more correct than its current one. Chapati dough water largely bakes into the final
bread rather than draining away like a boiled egg's water does - this script's binary
`excluded_cooking_medium` classification can't currently tell "water that's drained" apart from
"water that's incorporated" on its own. Every row in this category needs a human reviewer to
confirm the water really was discarded before any correction is applied - that's why
`needsReview` is `true` on literally every row this script produces, with no exceptions.

## Deliberately NOT auto-corrected: beverages and soups/stews

`db/recalc-recipes.ts` checks each water-flagged recipe's category
(`classifyFoodCategory`) and reports `unresolved` instead of a number for anything classified
`snack_beverage` or `international_recipe` (which also catches soups/stews by the classifier's own
word list). This guard exists because the dry run's first pass, before it was added, produced:

| Code | Name | Current kcal/100g | First-pass (wrong) proposal |
|---|---|---|---|
| `ASC001` | Hot tea (Garam Chai) | 16.1 | 102.6 (water excluded as if it were a discarded medium) |
| `ASC080` | Lentil soup | 31.2 | *(blocked by an unconvertible unit - see below - but would have been similarly wrong)* |

A cup of tea is mostly water *by design* - excluding that water doesn't fix a bug, it invents one.
These recipes are correctly left `unresolved` for now.

## Unresolved: frying-oil pan quantity (154 recipes, finding #1)

Every `frying_oil_pan_quantity`-flagged recipe reports `unresolved`, with no proposed value at
all, because no cited fat-absorption factor exists yet (`docs/NUTRITION_DATA_SOURCES.md`). Example
rows:

| Code | Name | Current kcal/100g | Oil/fat line as recorded |
|---|---|---|---|
| `ASC107` | Poori | 737.6 | `Fat`, 480.0 ml |
| `ASC351` | Potato pakora/pakoda | 677.2 | `Fat`, 480.0 ml |
| `BFP564` | Pearl millet mathri (Bajra mathri) | 785.1 | `Fat`, 480.0 ml |
| `BFP420` | Chicken pakora/pakoda | 590.1 | `Oil`, 240.0 ml |

These are exactly the recipes finding #1 describes: a pan-quantity oil/ghee line (or INDB's
generic "Fat"/"Shortening" placeholder) with nothing correcting for how much is actually absorbed.
Phase 5/6 cannot responsibly produce a number for these until Phase 3 sources and licence-checks
a fat-absorption factor.

## Unresolved: unconvertible units

A smaller set of rows (e.g. `ASC080` Lentil soup, which also has a `sprig` of coriander with no
documented gram weight) are reported `unresolved` purely because at least one ingredient line uses
a unit `indb/data/raw/Units.xlsx` doesn't define. These need either a manual gram assignment
(documented, not guessed) or exclusion of that specific negligible-weight garnish ingredient with
a stated rationale - not a blanket "ignore it" default.

## What a reviewer should do with this CSV

1. Open `db/audit-output/proposed_corrections.csv` (regenerate first with `pnpm recalc:recipes`
   if it's gone - it's gitignored).
2. For each `estimated` row: confirm by culinary knowledge (or a documented source) whether the
   matched water/stock line was genuinely drained/discarded. If yes, the proposed value is usable
   as `estimated` (never promote it to `calculated` without also supplying a documented retention
   factor). If the water is actually incorporated (dough, dal, rice), the row needs a different
   treatment - re-running with that ingredient reclassified as `contributing` instead of
   `excluded_cooking_medium`, which `recipe-calc.ts`'s engine already supports.
3. For each `unresolved` frying row: do not invent a number. Wait for
   `docs/NUTRITION_DATA_SOURCES.md`'s fat-absorption factor to be sourced and cited in Phase 3.
4. Nothing here is written to any table. Applying any of this is Phase 6's job, gated on your
   review of this exact file, per `docs/FOOD_DATA_MIGRATION.md`'s proposed migration design.
