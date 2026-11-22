-- Extra searchable names (Hindi/regional/Hinglish aliases) for indb foods, e.g. "chawal" -> rice,
-- "anda" -> egg. Lives in the app schema, NOT as rows in public.food_name: public is read-only from
-- app code and indb/load.py truncates/reloads it, so curated aliases added there would be wiped.
-- Same food_code-keyed, no-FK convention as app.food_diet_class (0005) and food_log.food_ref.
--
-- These are our own work product (hand-curated + AI-drafted-then-reviewed, loaded from a reviewed
-- CSV by db/seed-food-alias.ts). Nothing is copied from any third-party/competitor food database.
--
-- source: how the alias was produced - 'curated' (by us), 'ai_reviewed' (AI-drafted, human-checked),
--         or 'user' (a future user-submitted alias). lang: BCP-47-ish tag ('hi', 'en', 'hi-Latn'
--         for romanized Hindi/Hinglish). Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.food_alias (
    food_code   text NOT NULL,
    alias       text NOT NULL,
    lang        text NOT NULL DEFAULT 'en',
    source      text NOT NULL CHECK (source IN ('curated', 'ai_reviewed', 'user')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (food_code, alias, lang)
);

-- Trigram index so alias search uses the same `%`/similarity() path as indb's food_name_trgm.
CREATE INDEX IF NOT EXISTS food_alias_trgm ON app.food_alias USING gin (alias gin_trgm_ops);
