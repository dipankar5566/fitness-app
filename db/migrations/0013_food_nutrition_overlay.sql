-- Phase 5 of the food-nutrition audit (docs/FOOD_DATA_MIGRATION.md section 2) - purely additive
-- infrastructure to eventually hold a corrected nutrition value. No existing public.* or app.*
-- row is touched by this migration; no row is inserted into the new tables here either (that's
-- Phase 6, gated on a separate review of docs/FOOD_DATABASE_CORRECTIONS.md).

-- An app-owned, versioned overlay for a corrected food_code's nutrition - never a column on
-- public.food_nutrient, which stays read-only from app code (CLAUDE.md's architecture rule).
-- Same polymorphic-reference pattern as app.food_diet_class: food_code has no FK, since it can
-- point at an indb code, a custom_food id, or a packaged_food id depending on context.
CREATE TABLE IF NOT EXISTS app.food_nutrition (
    food_code           text NOT NULL,
    version             int NOT NULL,
    prep_state          text,
    prep_method         text,
    edible_portion_g    numeric,
    kcal_per_100g       numeric,
    protein_g_per_100g  numeric,
    fat_g_per_100g      numeric,
    carb_g_per_100g     numeric,
    fibre_g_per_100g    numeric,
    source              text NOT NULL,
    source_record_id    text,
    confidence          text NOT NULL CHECK (confidence IN ('verified', 'calculated', 'estimated', 'unverified')),
    last_verified_at    timestamptz,
    PRIMARY KEY (food_code, version)
);
CREATE INDEX IF NOT EXISTS food_nutrition_food_code_idx ON app.food_nutrition (food_code, version DESC);

-- A documented (or explicitly estimated) serving-unit gram weight, overriding public.serving_measure
-- without touching it - see docs/FOOD_DATABASE_AUDIT.md finding #4 (serving grams currently
-- inherit findings #1/#2's distortion via indb/load.py's derivation).
CREATE TABLE IF NOT EXISTS app.serving_definition (
    food_code  text NOT NULL,
    unit_name  text NOT NULL,
    grams      numeric NOT NULL,
    basis      text NOT NULL CHECK (basis IN ('documented', 'estimated')),
    source     text,
    PRIMARY KEY (food_code, unit_name)
);

-- A per-row nutrient snapshot on app.food_log, so a historical log's displayed macros are frozen
-- to what enrichWithMacros actually returned at save time, never silently rewritten by a later
-- app.food_nutrition correction (docs/FOOD_DATABASE_AUDIT.md finding #10). Nullable: a pre-existing
-- row has no snapshot until the one-off backfill (db/backfill-food-log-snapshot.ts) runs, and
-- enrichWithMacros falls back to live computation whenever the snapshot is null - see that
-- function's own comment.
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS kcal_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS protein_g_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS fat_g_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS carb_g_snapshot numeric;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS nutrition_confidence text;
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS nutrition_version int;
-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS" for CHECK constraints - DROP IF EXISTS + ADD is
-- the standard idempotent equivalent, safe to re-run like every other statement in this file.
ALTER TABLE app.food_log DROP CONSTRAINT IF EXISTS food_log_nutrition_confidence_check;
ALTER TABLE app.food_log ADD CONSTRAINT food_log_nutrition_confidence_check
    CHECK (nutrition_confidence IS NULL OR nutrition_confidence IN ('verified', 'calculated', 'estimated', 'unverified'));

-- docs/FOOD_DATABASE_AUDIT.md finding #11: an Open Food Facts value has never carried any
-- provenance marker distinguishing it from a manually-verified manufacturer label. Separate from
-- the existing `review_status` column (that's a moderation-workflow state - pending/approved/
-- rejected - not an epistemic-confidence one; the two are orthogonal, so neither is repurposed to
-- mean the other). Every existing row is `source = 'off'` today (confirmed via psql in the audit
-- pass), so defaulting every row to 'unverified' here is accurate, not just a safe default.
ALTER TABLE app.packaged_food ADD COLUMN IF NOT EXISTS confidence text NOT NULL DEFAULT 'unverified';
ALTER TABLE app.packaged_food DROP CONSTRAINT IF EXISTS packaged_food_confidence_check;
ALTER TABLE app.packaged_food ADD CONSTRAINT packaged_food_confidence_check
    CHECK (confidence IN ('verified', 'calculated', 'estimated', 'unverified'));
