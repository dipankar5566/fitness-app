-- Per-meal relevance score for each indb food, powering "what to log next" suggestions per meal.
-- app-owned and food_code-keyed (no FK), same convention as app.food_diet_class (0005) and
-- app.food_alias (0006) - public.food is read-only and reloaded by indb/load.py, so this can't live
-- there. Backfilled by db/backfill-meal-relevance.ts using packages/shared's scoreMealRelevance
-- (observed app.food_log counts blended with a name-derived prior). Our own heuristic; nothing is
-- taken from any third-party food database. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.food_meal_relevance (
    food_code    text NOT NULL,
    meal_type    text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    score        real NOT NULL,                 -- normalized across the four meals; the four sum to 1
    method       text NOT NULL,                 -- e.g. 'relevance_v1'
    computed_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (food_code, meal_type)
);

-- Lookup path for the suggestions endpoint: best foods for a given meal, highest score first.
CREATE INDEX IF NOT EXISTS food_meal_relevance_by_meal
    ON app.food_meal_relevance (meal_type, score DESC);
