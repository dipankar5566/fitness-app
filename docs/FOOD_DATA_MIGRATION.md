# Food Data Migration — Backup Record + Proposed (Not Implemented) Design

## Part 1: Backup taken before this audit (done)

Before any read of the database in this audit pass, two `pg_dump` backups were taken of the real
local `indb` database and verified restorable. These live outside the repository (a dev machine's
local filesystem, not committed - a database dump is not source code and shouldn't be tracked).

| File | Scope | SHA-256 |
|---|---|---|
| `indb-full-pre-audit-2026-11-24.dump` | Entire `indb` database (`public` + `app` schemas), custom format | `96998860e675a3b02115c8e2c9978dc641d5e928f14717c4ed5d079492b31e9c` |
| `indb-app-schema-pre-audit-2026-11-24.dump` | `app` schema only | `44f71531833ed60e5df3d3c78339a9130419ddee304299c796719c43c05aa18d` |

Verified readable: `pg_restore --list` against the full dump enumerated 36 `TABLE DATA` entries
with no error. **Not restored** - verifying the dump is readable doesn't require restoring it, and
this audit made no changes that would need a restore.

Row-count baseline captured at the same time (`row-counts-pre-audit-2026-11-24.txt`, alongside the
dumps):

```
app.custom_food|2
app.custom_food_ingredient|2
app.food_alias|31
app.food_diet_class|1346
app.food_log|23
app.food_meal_relevance|5384
app.packaged_food|2
food|1346
food_external_ref|306
food_name|2949
food_nutrient|48606
recipe_ingredient|10271
serving_measure|917
```

This audit's entire read phase (`pnpm audit:food`, `pnpm recalc:recipes`) ran inside
`BEGIN READ ONLY` transactions - re-running the same row-count query after this pass should (and
does) return identical numbers, confirming nothing changed.

## Part 2: Phase 5 — IMPLEMENTED (2026-11-24)

Everything in this section is now built and verified against the real `indb` database. It
follows CLAUDE.md's architecture rules (`public.*` stays read-only from app code; a new syncable
table needs `id/account_id/is_deleted/updated_at`) and the confidence-tier system from
`docs/NUTRITION_CALCULATION_METHODOLOGY.md`. **Phase 6 (actually applying a correction) is still
not done** - `app.food_nutrition` is live but empty (confirmed: `SELECT count(*)` returns 0).

### 2.1 `app.food_nutrition` — a versioned correction overlay — DONE

Built exactly as designed, via `0013_food_nutrition_overlay.sql`, confirmed empty
(`SELECT count(*)` = 0 - no Phase 6 correction has been applied) and wired into
`food-log.service.ts`'s read path (checked before falling back to the live indb/USDA value) - see
2.3 below for how that's verified.

```sql
CREATE TABLE app.food_nutrition (
    food_code       text NOT NULL,              -- references public.food.code (no FK - polymorphic
                                                  -- across indb/custom/packaged, same reason
                                                  -- app.food_diet_class has no FK either)
    version         int NOT NULL,
    prep_state      text,                        -- 'raw' | 'boiled' | 'fried' | ... | null
    prep_method     text,
    edible_portion_g numeric,
    kcal_per_100g    numeric,
    protein_g_per_100g numeric,
    fat_g_per_100g   numeric,
    carb_g_per_100g  numeric,
    fibre_g_per_100g numeric,
    source           text NOT NULL,              -- 'indb' | 'usda' | 'calculated' | 'manufacturer_label'
    source_record_id text,
    confidence       text NOT NULL CHECK (confidence IN ('verified','calculated','estimated','unverified')),
    last_verified_at timestamptz,
    PRIMARY KEY (food_code, version)
);
```

`FoodService.getDetail`/`getNutrientSummaries` would check this overlay first (highest `version`),
falling back to `public.food_nutrient` only when no overlay row exists - never editing
`public.food_nutrient` directly, honoring the existing read-only rule.

### 2.2 `app.serving_definition` — schema done, unused so far

Built via `0013_food_nutrition_overlay.sql`. **Not yet wired into any read path** - no app code
checks this table yet, since no `serving_measure` correction has been proposed for this pass (that
would be part of a future Phase 6 covering finding #4). The table exists so that work needs no
further schema change when it happens.

```sql
CREATE TABLE app.serving_definition (
    food_code  text NOT NULL,
    unit_name  text NOT NULL,
    grams      numeric NOT NULL,
    basis      text NOT NULL CHECK (basis IN ('documented','estimated')),
    source     text,
    PRIMARY KEY (food_code, unit_name)
);
```

Same role `app.food_diet_class`/`app.food_nutrition` play: an app-owned overlay, never touching
`public.serving_measure`.

### 2.3 `app.food_log` gains a nutrient snapshot + confidence + version — DONE

Built exactly as designed, via `0013_food_nutrition_overlay.sql`:

```sql
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS kcal_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS protein_g_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS fat_g_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS carb_g_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS nutrition_confidence text;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS nutrition_version int;
```

`food-log.service.ts`'s `enrichWithMacros` now reads the snapshot when present (`kcal_snapshot
!= null`) and falls back to live computation only when it's null - the exact rule this section
specified. `FoodLogService.create`/`update` and (the actually-used mobile write path)
`SyncService.push`'s food_log handling all compute and store the snapshot via a new shared
`computeNutritionSnapshot` function, so a new log's snapshot and the live-fallback path can never
disagree on how a value is derived.

**The backfill ran** (`db/backfill-food-log-snapshot.ts --write`) before anything else touched
`app.food_nutrition`, satisfying the ordering requirement below exactly: all 23 pre-existing
`food_log` rows now have a snapshot (21 resolved to real values, 2 stayed null because the
underlying data genuinely can't resolve them today - e.g. a logged `unit` that doesn't match any
`serving_measure` name for that food, same as `listByDate` would show live). Verified by hand
against the real database: one row's backfilled value (idli, 68.9 kcal) was independently
recomputed from `food_nutrient`/`serving_measure` and matched exactly;
`updated_at`/`server_updated_at` were confirmed unchanged on every backfilled row (critical - see
below). A live smoke test against a running server (not just mocks) then confirmed a *newly*
created log via `POST /food-log` and a *newly pushed* log via `POST /sync` both compute and store
the correct snapshot immediately, matching the backfill's own numbers for the same food/quantity.

**Critical ordering, called out explicitly, and honored**: this backfill ran and was verified
*before* any correction from `docs/FOOD_DATABASE_CORRECTIONS.md` is applied to `app.food_nutrition`
(confirmed: that table is empty - `SELECT count(*) FROM app.food_nutrition` returns 0). The
backfill step computed each existing `food_log` row's snapshot from **today's** (pre-correction)
values, so a historical log's displayed macros are frozen to what the user actually saw at the
time, never silently rewritten by a later correction (finding #10). A new log created after a
correction ships will get its snapshot from the corrected `app.food_nutrition` overlay instead
(confirmed wired and working via a mocked unit test - see `docs/NUTRITION_QA_REPORT.md`), tagged
with the new version/confidence - so old and new logs will coexist correctly, each honestly
describing its own provenance.

### 2.4 App-side bug fixes

- **Done**: `food-log.service.ts`'s custom-food resolver (renamed `computeCustomFoodMacros`) no
  longer silently treats a missing ingredient's nutrients the same as a fully-resolved recipe
  (finding #8) - it now tags the result `estimated` instead of `calculated` whenever at least one
  ingredient's nutrients couldn't be resolved. This is a **labeling-only** fix: the arithmetic is
  unchanged (an unresolved ingredient's grams still count toward the total, exactly as before,
  per the "no corrected value yet, just honest infrastructure" scope for this pass) - only the
  confidence tier now tells the truth about the gap.
- **Done**: `PackagedFoodService` has a real `confidence` column (defaulting `unverified` for every
  Open-Food-Facts-sourced row, finding #11), surfaced through `getNutrientSummaries` into a
  packaged-food log's `nutrition_confidence` snapshot. **Not done**: the UI badge itself
  (`LogPackagedFoodScreen`) - see 2.5, out of this pass's scope.
- **Not done, by design**: `resolveGrams`/the packaged-food branch still treats `ml` as `g`
  (finding #9) - still needs a density lookup per ingredient (water-equivalent density 1 isn't
  correct for oil, ~0.92) that doesn't exist yet. Flagging every `ml`-unit log as lower-confidence
  without that data would itself be a guess, so this was deliberately left both numerically and
  confidence-wise unchanged.
- **Not done, blocked on finding #5**: `app.food_alias` still points "rice", "moong dal", "rajma",
  etc. at a raw/dry ingredient - there's no cooked-state record to re-point them to yet.

### 2.5 UI: confidence badge — not built this pass

A small badge on the food detail/log screens, matching the visual language `apps/mobile` already
uses for `LogMealFromTextScreen`'s `isEstimate` flag, remains a `apps/mobile`-side follow-up -
confirmed unnecessary for the *correctness* fix itself (the mobile client already stores whatever
`macros` the server's `/sync` pull returns verbatim as its local cache - `food-log-repo.ts`'s own
comment: "server is always the source of truth for macros" - so historical-integrity doesn't
depend on any mobile change), but a real UI gap: `nutrition_confidence` is now computed and stored
server-side with nowhere in the app yet showing it to a user.

### 2.6 Rollback

- Schema: every `ALTER TABLE`/`CREATE TABLE` above is additive (new columns, new tables) - a
  rollback is `DROP TABLE app.food_nutrition, app.serving_definition;` and dropping the five new
  `food_log` columns, with no data loss to anything that existed before this migration.
- Data: a bad correction in `app.food_nutrition` is rolled back by inserting a new, higher
  `version` row (or deleting the bad version) - `food_log` rows already snapshotted at the time of
  the bad version are unaffected either way, which is exactly why the snapshot design in 2.3
  exists.
- Full restore path, if ever needed: `pg_restore -d indb indb-full-pre-audit-2026-11-24.dump`
  against the dump recorded in Part 1 above (not expected to be needed - this is the standard
  "how would we get back to today" answer, not a plan to actually do it).

## Approval gate

Per explicit user go-ahead ("build Phase 5"), section 2 above is now implemented, with Phase 6
(an actual correction value in `app.food_nutrition`) still untouched - confirmed empty. The 2.4/2.5
items marked "not done" above, and all of Phase 6, still need their own go-ahead before any
further code or data change.
