-- Diet classification for indb foods (veg/non-veg/egg/vegan + Jain suitability), backfilled by
-- db/backfill-diet-class.ts. Lives in the app schema, not as a column on public.food: the indb
-- schema is read-only from app code, 0001_indb.sql must stay a verbatim copy of indb/schema.sql,
-- and indb/load.py truncates/reloads public.food (a column there would be wiped). Keyed by
-- food_code text with no FK, same convention as food_log.food_ref.
-- diet_class NULL = the heuristic couldn't tell; the app shows those foods tagged "unverified".
-- Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.food_diet_class (
    food_code      text PRIMARY KEY,
    diet_class     text CHECK (diet_class IN ('vegan', 'veg', 'egg', 'non_veg')),
    jain_ok        boolean,
    method         text NOT NULL,
    classified_at  timestamptz NOT NULL DEFAULT now()
);
