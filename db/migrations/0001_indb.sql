-- INDB starter schema (PostgreSQL 13+). Idempotent: safe to re-run.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS source (
    id            serial PRIMARY KEY,
    name          text NOT NULL UNIQUE,
    license       text NOT NULL,
    url           text NOT NULL,
    citation      text NOT NULL,
    retrieved_at  timestamptz,
    file_sha256   jsonb
);

CREATE TABLE IF NOT EXISTS food (
    id         serial PRIMARY KEY,
    code       text NOT NULL UNIQUE,              -- INDB recipe code (ASC001) or ingredient code (L002)
    name       text NOT NULL,
    food_type  text NOT NULL CHECK (food_type IN ('recipe', 'ingredient')),
    category   text,                              -- recipe primary source: asc_manual / bfp_manual / open_source_recipes
    source_id  int NOT NULL REFERENCES source(id)
);

CREATE TABLE IF NOT EXISTS food_name (
    food_id     int  NOT NULL REFERENCES food(id) ON DELETE CASCADE,
    name        text NOT NULL,
    lang        text NOT NULL DEFAULT 'en',
    is_primary  boolean NOT NULL DEFAULT false,
    origin      text NOT NULL DEFAULT 'indb',     -- indb | indb_bracket | indb_variant | curated
    PRIMARY KEY (food_id, name, lang)
);
ALTER TABLE food_name ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'indb';
CREATE INDEX IF NOT EXISTS food_name_trgm ON food_name USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS nutrient (
    id    serial PRIMARY KEY,
    code  text NOT NULL UNIQUE,                   -- e.g. energy_kcal, protein_g
    name  text NOT NULL,
    unit  text NOT NULL
);

CREATE TABLE IF NOT EXISTS food_nutrient (
    food_id      int NOT NULL REFERENCES food(id) ON DELETE CASCADE,
    nutrient_id  int NOT NULL REFERENCES nutrient(id),
    per_100g     numeric,
    per_serving  numeric,
    source_id    int REFERENCES source(id),        -- INDB for recipes, USDA for ingredients
    PRIMARY KEY (food_id, nutrient_id)
);
ALTER TABLE food_nutrient ADD COLUMN IF NOT EXISTS source_id int REFERENCES source(id);

-- Links from a food to the record it was matched to in an external database (e.g. USDA FDC id).
CREATE TABLE IF NOT EXISTS food_external_ref (
    food_id      int  NOT NULL REFERENCES food(id) ON DELETE CASCADE,
    source_id    int  NOT NULL REFERENCES source(id),
    external_id  text NOT NULL,
    description  text,
    match        text CHECK (match IN ('exact', 'close', 'proxy')),   -- proxy = nearest available substitute
    note         text,
    PRIMARY KEY (food_id, source_id)
);

CREATE TABLE IF NOT EXISTS serving_measure (
    food_id     int NOT NULL REFERENCES food(id) ON DELETE CASCADE,
    name        text NOT NULL,                    -- bowl, plate, piece, ...
    grams       numeric,                          -- derived: per_serving / per_100g * 100
    is_default  boolean NOT NULL DEFAULT true,
    PRIMARY KEY (food_id, name)
);

CREATE TABLE IF NOT EXISTS recipe_ingredient (
    recipe_food_id      int NOT NULL REFERENCES food(id) ON DELETE CASCADE,
    position            int NOT NULL,
    ingredient_food_id  int REFERENCES food(id),
    ingredient_name     text NOT NULL,            -- name as written in the original recipe
    quantity            numeric,
    unit                text,
    PRIMARY KEY (recipe_food_id, position)
);

CREATE OR REPLACE VIEW v_food_macros AS
SELECT f.id, f.code, f.name, sm.name AS serving_unit, round(sm.grams, 1) AS serving_grams,
       max(fn.per_100g)    FILTER (WHERE n.code = 'energy_kcal') AS kcal_100g,
       max(fn.per_100g)    FILTER (WHERE n.code = 'protein_g')   AS protein_100g,
       max(fn.per_100g)    FILTER (WHERE n.code = 'fat_g')       AS fat_100g,
       max(fn.per_100g)    FILTER (WHERE n.code = 'carb_g')      AS carb_100g,
       max(fn.per_100g)    FILTER (WHERE n.code = 'fibre_g')     AS fibre_100g,
       max(fn.per_serving) FILTER (WHERE n.code = 'energy_kcal') AS kcal_serving,
       max(fn.per_serving) FILTER (WHERE n.code = 'protein_g')   AS protein_serving,
       max(fn.per_serving) FILTER (WHERE n.code = 'fat_g')       AS fat_serving,
       max(fn.per_serving) FILTER (WHERE n.code = 'carb_g')      AS carb_serving,
       max(fn.per_serving) FILTER (WHERE n.code = 'fibre_g')     AS fibre_serving
FROM food f
JOIN food_nutrient fn ON fn.food_id = f.id
JOIN nutrient n       ON n.id = fn.nutrient_id
LEFT JOIN serving_measure sm ON sm.food_id = f.id AND sm.is_default
WHERE f.food_type = 'recipe'
GROUP BY f.id, f.code, f.name, sm.name, sm.grams;

CREATE OR REPLACE FUNCTION search_foods(q text, lim int DEFAULT 20)
RETURNS TABLE (food_id int, code text, name text, food_type text, score real)
LANGUAGE sql STABLE AS $$
    SELECT f.id, f.code, f.name, f.food_type, max(similarity(fn.name, q)) AS score
    FROM food_name fn JOIN food f ON f.id = fn.food_id
    WHERE fn.name % q OR fn.name ILIKE '%' || q || '%'
    GROUP BY f.id, f.code, f.name, f.food_type
    ORDER BY (f.food_type = 'recipe') DESC, score DESC
    LIMIT lim
$$;
