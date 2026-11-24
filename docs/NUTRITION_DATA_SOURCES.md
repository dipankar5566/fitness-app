# Nutrition Data Sources — Hierarchy, Licensing, Provenance

Companion to `docs/FOOD_DATABASE_AUDIT.md`. States, for every source this project uses or has
considered, its licence, what it's used for, and what's still unverified. No source is used
unless its licence is confirmed below as compatible with this commercial app.

## Priority order

### 1. INDB (Indian Nutrient Databank, Anuvaad Solutions)

- **Licence**: CC BY 4.0 - confirmed in `app.source` (`license = 'CC BY 4.0'`) and
  `indb/README.md`'s attribution block. Commercial reuse is permitted with attribution.
- **Citation**: Vijayakumar A, et al. *Development of an Indian Food Composition Database.*
  Current Developments in Nutrition, 2024. Repository:
  `github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-`.
- **Used for**: recipe ingredient lines and household serving names (both CC BY, both reused as-
  is - these are facts about what a dish contains, not disputed nutrient values). Recipe
  *nutrient values* are used only where `docs/FOOD_DATABASE_AUDIT.md`'s checks pass, or where a
  recalculation from ingredients (per `docs/NUTRITION_CALCULATION_METHODOLOGY.md`) replaces them.
- **Methodology paper now fetched and read in full** (second pass, 2026-11-24):
  Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM. *Development of an Indian Food Composition
  Database.* Current Developments in Nutrition, 8(7):103790, July 2024. Open access, CC BY 4.0 -
  confirmed in the article's own text ("This is an open access article under the CC BY license"),
  data files on GitHub. `https://pmc.ncbi.nlm.nih.gov/articles/PMC11277795/`.
  **This directly confirms findings #1/#2's root cause**, upgrading them from inferred (from raw
  data patterns) to stated in INDB's own published methodology: *"The nutrient content of all
  ingredients in a recipe was summed to obtain the total nutrient content per 100 g of the recipe
  and per serving"* - i.e. recipe weight is the literal sum of every recorded ingredient quantity,
  including a frying medium's full pan quantity and a boiling medium's full water volume, with no
  yield/absorption adjustment in the primary calculation. The paper does describe a **sensitivity
  analysis** using the USDA Nutrient Retention Factors table (confirming our own identification of
  that document as the relevant USDA resource), but states it only **matched 42.62% of
  ingredients** to a retention value - and, per that table's own scope (section 3 above), those
  factors cover vitamins/minerals only, never kcal/protein/fat/carb, so even a fully-applied
  sensitivity analysis would not have touched the macro/energy values this audit is about. The
  paper's own stated limitation: *"It is possible further nutrient losses occur that were not
  accounted for... considering some raw foods included in the INDB were not available in the USDA
  database and cooking practices may differ."*
- **IFCT provenance, confirmed but not fully resolved**: the paper states INDB's stage-1
  (ingredient) database was *"primarily derived from the [ICMR-NIN IFCT] from 2017"*. It does not
  state whether ICMR-NIN explicitly authorized this redistribution under CC BY - the paper
  asserts the licence but doesn't document NIN's consent to it. This doesn't change this project's
  posture (IFCT itself remains unused directly, per the approved decision), but it means INDB's
  *existing* ingredient values likely already carry whatever IFCT lineage this project would have
  gained by negotiating separately - worth noting for whoever pursues the NIN conversation
  mentioned below, since the relationship may already be closer than a cold outreach would assume.

### 2. USDA FoodData Central (SR Legacy, Foundation Foods, FNDDS)

- **Licence**: CC0 1.0 (public domain) - confirmed in `app.source`. No attribution legally
  required, though `indb/README.md` credits USDA anyway (good practice, kept).
- **Used for**: raw ingredient values already in this database (306 of 332 ingredients, per
  `indb/README.md`); the source for cooked-state ingredient records this database currently lacks
  (finding #5); cross-verification of any INDB recipe value before it's trusted as-is.
- **Access method**: offline bulk CSV/API fetch via `indb/usda_fetch.py`/`usda_match.py`
  (already in this repo, already used to build the existing 306-ingredient USDA mapping) - run
  from the backend/tooling side, never from `apps/mobile`. Any future direct FDC API call (e.g.
  for an on-demand lookup) must go through `apps/api`, exactly like `PackagedFoodService`'s
  Open Food Facts calls already do - client-side exposure of an API key is the architecture rule
  this guards against (CLAUDE.md: "Never expose API keys in the Android application").

### 3. USDA cooking yield & nutrient retention factors — now fetched and verified

**Update (2026-11-24, second pass): network access was confirmed working in this environment
after the Phase 1–4 pass above was written** (the earlier "no outbound network access" note was
a sandboxed-shell restriction specific to the Bash tool's DNS resolution, not a true absence of
connectivity - `WebFetch`/`WebSearch` work). Both documents below were fetched directly from
`ars.usda.gov` and read in full.

- **USDA Table of Cooking Yields for Meat and Poultry, Release 2** (Roseland, Nguyen, Williams,
  Patterson, Showell, Pehrsson; Nutrient Data Laboratory, ARS, USDA; September 2014).
  `https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.pdf`.
  US federal government work - public domain, same status already relied on for SR Legacy/FNDDS.
  Covers cooking yield % (`Yield = 100 × Wcooked/Wraw`), % moisture change, and % fat change for
  beef, pork, poultry (including chicken drumsticks/thighs, whole turkey), veal, and alternate red
  meats, measured by real raw/cooked weighings and chemical fat/moisture analysis (acid
  hydrolysis, AOAC oven-drying) at USDA-contracted university labs. **Scope limitation**: this
  document is meat/poultry only - none of its cooking methods add frying oil (all explicitly "no
  fat added," or measured without-coating/without-drippings variants), so it does not supply a
  frying-oil-absorption factor (finding #1) - it is directly usable for any future Indian
  chicken/mutton/egg(poultry-category, see below)-based recipe correction, not for pakora/poori.
- **USDA Table of Nutrient Retention Factors, Release 6** (Nutrient Data Laboratory, ARS, USDA;
  December 2007). `https://www.ars.usda.gov/ARSUserFiles/80400525/Data/retn/retn06.pdf`. Also US
  federal public domain. **Important scope correction to the Phase 1–4 note above**: this table
  covers **26 vitamins/minerals/alcohol only** - it explicitly does *not* publish protein/fat/
  carb/energy retention factors. USDA's own stated practice for macro/energy values of a cooked
  food is to measure and publish a *separate, directly analyzed* SR Legacy record for the cooked
  state (exactly the raw/cooked egg pair found below), not to derive it from a raw value via a
  retention percentage - that distinction changes how Phase 5/6 should use this table: for
  **vitamins/minerals** it is a real, citable retention-factor source; for the **macro/kcal
  corrections this audit's findings are actually about**, the right USDA resource is a matched
  raw/cooked SR Legacy pair, not this table.
  - **Directly confirms this project's engine design**: retention codes 0501/0502 ("LEGUMES,
    CKD 15/20MIN,BOILED,**DRAINED**" vs "...BOILED,**WATER USED**"), 0381/0384 ("PASTA,BOILED,
    **DRAINED**" vs "...BOILED,**NOT DRAINED**"), and 0431/0432 ("RICE,...,COOKED,**DRAINED**"
    vs "...,**WATER USED**") are *separate, officially documented preparation categories* in
    USDA's own system - i.e. USDA itself treats "was the cooking water drained or incorporated"
    as a real, material distinction requiring a different factor, not a detail to average over.
    This is independent, authoritative confirmation that `recipe-calc.ts`'s
    `excluded_cooking_medium` vs `contributing` role split (finding #2's fix) is the right shape
    of correction, not an invented one - though the *specific* retention values in this table are
    for vitamins/minerals, not for the kcal/macro correction itself.
- **A matched raw/cooked SR Legacy pair for egg - found and directly verified via the primary
  USDA FDC API** (`api.nal.usda.gov/fdc/v1/food/<id>`, not a secondary site): raw whole egg
  (FDC 171287, "Egg, whole, raw, fresh") = 143 kcal, 12.56g protein, 9.51g fat, 0.72g carb per
  100g - this is an exact match (to the decimal already stored) for INDB's own `M001` ingredient,
  confirming `M001` is itself sourced from this exact USDA record. Hard-boiled egg (FDC 173424,
  "Egg, whole, cooked, hard-boiled", SR Legacy) = **155 kcal**, 12.58g protein, 10.61g fat, 1.12g
  carb per 100g (reflecting real ~8% moisture loss through the shell during boiling - USDA's own
  measured value, not a derived estimate). **This directly closes part of finding #2/#5 for
  eggs**: a corrected `app.food_nutrition` overlay for "Boiled egg" could cite this exact FDC
  record (155 kcal/100g) instead of either INDB's current 45 kcal/100g or a recalculated estimate
  - it would be `verified`, not `calculated`, the strongest tier available.
- **Phase 3 status, updated**: for **meat/poultry/egg** corrections, real primary sources are now
  confirmed and cited above. For **plant-based staples** (rice, dal, wheat) that make up most of
  the 132 water-share recipes, the same two-value approach (find the matched USDA SR Legacy
  cooked-state record, e.g. "Rice, white, long-grain, regular, cooked" or "Lentils, boiled") is
  the right path but individual FDC IDs for each Indian-recipe-relevant pulse/grain were not all
  looked up in this pass - a mechanical follow-up task, not a blocked one.

### 4. A fat-absorption factor for frying

- **Status**: **still no clean, citable absorption-fraction factor found.** The one candidate
  primary source identified (Culinary Science & Technology journal article on vegetable oil
  absorption in fried recipes, via `tandfonline.com`) returned HTTP 403 (paywalled) when fetched
  directly - only a secondhand search-engine summary of it exists, which is not citable as a
  verified source per the brief's own rule ("never claim a value is verified without an
  identifiable source"). This blocks any real correction to finding #1 (154 recipes).
  `packages/shared/src/recipe-calc.ts`'s engine supports this correction
  (`FryingAbsorptionFactor`) the moment a citable number exists, and deliberately returns
  `tier: "unresolved"` without one.
- **A real empirical reference point, found and verified directly via the primary USDA FDC API**
  (not a clean absorption-fraction factor, but a genuine, citable raw-vs-fried comparison): raw
  potato, flesh and skin (FDC 170026, SR Legacy) = 77 kcal, 0.09g fat, 17.49g carb per 100g;
  "Fast foods, potato, french fried in vegetable oil" (FDC 170698, SR Legacy) = **312 kcal,
  14.73g fat, 41.44g carb per 100g**. This shows frying's real composition impact on a directly
  comparable food, but SR Legacy does not publish an accompanying cooking-yield (weight-change)
  figure for this pair, so it cannot yet be turned into a clean "fraction of pan oil absorbed"
  the way `FryingAbsorptionFactor` needs - using it would require assuming a cooking yield %,
  which would itself be an unsourced number. Recorded here as a documented, real candidate for a
  future pass, not used to produce any value in this one.
- **Remaining candidate sources for a real Phase 3+ follow-up**: obtaining the paywalled
  tandfonline paper through an institutional/library access route; FAO/INFOODS published
  recipe-calculation guidance (not yet located/fetched); a USDA Foundation Foods record that
  happens to publish both a cooking yield % and a fat value for a fried item together.

### 5. Verified manufacturer nutrition labels

- **Status**: no packaged-food label has been manually captured against this project's own
  photographed/sourced pack yet - the 2 existing `app.packaged_food` rows both came via
  Open Food Facts (source #6 below), not a verified label capture.
- **When used**: must record brand, product name, serving size, and the full label's values
  (brief section 2), plus a capture date, and must be flagged `verified` distinctly from an OFF
  row. `docs/NUTRITION_CALCULATION_METHODOLOGY.md`'s confidence-tier section defines this.

### 6. Open Food Facts

- **Licence**: ODbL (Open Database License) - **share-alike**. This is why `app.packaged_food`
  is architecturally separate from the CC BY/CC0 `public.*` tables (`CLAUDE.md`'s own
  architecture rule, already followed correctly: "Open Food Facts data stays in
  `app.packaged_food`, never in the indb-derived tables"). No violation found; this section just
  records why that separation exists.
- **Used for**: barcode lookups (`PackagedFoodService`). Crowdsourced, so always tier
  `unverified` until a human confirms it against the actual label (finding #11) - never presented
  as `verified`.

### IFCT 2017 (ICMR-NIN) — not licensed, used only as a citation/cross-check

- **Status**: © ICMR-National Institute of Nutrition. No commercial reuse permission exists for
  this project. Per the approved plan, this is **not imported**: no IFCT value is stored anywhere
  in `public.*` or `app.*`.
- **Use that remains allowed without permission**: citing IFCT's publicly stated values in this
  documentation (as a cross-check number, with the citation `nin.res.in/ebooks/IFCT2017.pdf`),
  the way `docs/FOOD_DATABASE_AUDIT.md` would reference it if a specific comparison were made -
  none was made in this pass beyond what's already public knowledge about IFCT's existence and
  scope.
- **Adapter, built but disabled**: none of this pass's code has an IFCT import path - there is
  nothing to disable, because nothing was written against it. If permission is obtained later,
  a new `db/import-ifct.ts` would follow the same shape as `db/import-exercises.ts`/
  `db/seed-food-alias.ts` (a dedicated, re-runnable, source-pinned script), landing its data in a
  new `app.*` overlay table per `docs/FOOD_DATA_MIGRATION.md`'s proposed design - never into
  `public.*`.
- **Why this might be realistic to pursue** (recorded for whoever picks this up, not yet acted
  on): the HealthifyMe teardown's public-source research (`healthifyme-re/README.md`, cited in
  the approved plan for this audit) states HealthifyMe's own Indian food database was built "in
  collaboration with the National Institute of Nutrition (NIN, Hyderabad - publisher of IFCT)" -
  a competitor obtaining exactly this kind of cooperation suggests it's not a closed door, just
  an unexplored one.

## Summary table

| Source | Licence | Status | Used for |
|---|---|---|---|
| INDB | CC BY 4.0 | In use | Recipe ingredients/servings; recipe values where audit passes |
| USDA FDC (SR Legacy/Foundation/FNDDS) | CC0 | In use; egg + potato raw/cooked pairs verified directly | Raw + cooked ingredient values |
| USDA Cooking Yields for Meat and Poultry (2014) | US Gov public domain | **Fetched and verified** | Meat/poultry/egg cooking-yield corrections |
| USDA Nutrient Retention Factors, Release 6 (2007) | US Gov public domain | **Fetched and verified** - vitamins/minerals only, not macros | Confirms the drained-vs-incorporated-water design; not a macro/kcal source itself |
| A fat-absorption factor for frying | TBD - still not sourced (candidate paper paywalled) | **Still blocking finding #1** | Frying-oil correction (Phase 3+) |
| Manufacturer labels | Facts, no licence issue | Not yet captured | Packaged foods, `verified` tier only |
| Open Food Facts | ODbL (share-alike) | In use, isolated in `app.packaged_food` | Packaged foods, `unverified` tier |
| IFCT 2017 | © ICMR-NIN, unlicensed | **Not used** | Citation/cross-check only |

## Backend-only access rule

Every network call to an external nutrition source (USDA FDC API, Open Food Facts, a future IFCT
API if one existed) happens from `apps/api`, never from `apps/mobile` - this is already the
pattern `PackagedFoodService` and `OpenAiProvider` follow, and the HealthifyMe teardown
(`healthifyme-re/README.md`) independently confirms the same architecture for their own
third-party nutrition source (FatSecret is proxied through their backend; "no fatsecret.com host
in app"). No change needed here - recorded so Phase 3's USDA factor-fetching work follows the
existing rule rather than reinventing it.
