-- App schema (new) - ARCHITECTURE.md section 2. The `indb` food data (0001_indb.sql) lives in the
-- public schema, unchanged, and is referenced by code (not by FK, since food_log.food_ref is
-- polymorphic across indb/packaged/custom). Idempotent: safe to re-run.
CREATE SCHEMA IF NOT EXISTS app;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS app.account (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone         text UNIQUE,
    email         text UNIQUE,
    auth_provider text NOT NULL DEFAULT 'guest' CHECK (auth_provider IN ('guest', 'phone_otp', 'google', 'password')),
    is_guest      boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);

CREATE TABLE IF NOT EXISTS app.profile (
    account_id          uuid PRIMARY KEY REFERENCES app.account(id) ON DELETE CASCADE,
    sex                 text CHECK (sex IN ('male', 'female')),
    dob                 date,
    height_cm           numeric,
    activity_level      text CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    diet_type           text CHECK (diet_type IN ('veg', 'eggetarian', 'non_veg', 'vegan', 'jain')),
    consent_health_data_at      timestamptz,
    consent_health_data_version text
);

CREATE TABLE IF NOT EXISTS app.goal (
    id                           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id                   uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    mode                         text NOT NULL CHECK (mode IN ('bulk', 'cut', 'recomp', 'maintain')),
    target_kcal                  numeric,
    target_protein_g             numeric,
    target_carb_g                numeric,
    target_fat_g                 numeric,
    training_day_adjustment_pct  numeric NOT NULL DEFAULT 0.1,
    started_at                   timestamptz NOT NULL DEFAULT now(),
    is_active                    boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS goal_account_active_idx ON app.goal (account_id) WHERE is_active;

-- Packaged foods (Open Food Facts India, ODbL) - kept out of the CC BY/CC0 `indb` tables deliberately
-- (ARCHITECTURE.md section 2): ODbL's share-alike applies to this table, not to indb's CC BY/CC0 data.
CREATE TABLE IF NOT EXISTS app.packaged_food (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode       text UNIQUE NOT NULL,
    name          text NOT NULL,
    brand         text,
    nutrients     jsonb NOT NULL,                 -- per-100g, keyed like indb.nutrient.code where possible
    source        text NOT NULL DEFAULT 'off' CHECK (source IN ('off', 'user_submitted')),
    review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.custom_food (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    name        text NOT NULL,
    is_deleted  boolean NOT NULL DEFAULT false,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.custom_food_ingredient (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    custom_food_id  uuid NOT NULL REFERENCES app.custom_food(id) ON DELETE CASCADE,
    food_source     text NOT NULL CHECK (food_source IN ('indb', 'packaged', 'custom')),
    food_ref        text NOT NULL,                -- indb.food.code | packaged_food.id | custom_food.id
    quantity_g      numeric NOT NULL
);

-- Syncable tables share: client-generated uuid id, account_id, is_deleted, updated_at (ARCHITECTURE.md section 3).
CREATE TABLE IF NOT EXISTS app.food_log (
    id           uuid PRIMARY KEY,                -- client-generated
    account_id   uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    food_source  text NOT NULL CHECK (food_source IN ('indb', 'packaged', 'custom')),
    food_ref     text NOT NULL,
    quantity     numeric NOT NULL,
    unit         text NOT NULL,
    meal_type    text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    logged_at    timestamptz NOT NULL,
    source       text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_text', 'ai_photo', 'barcode')),
    is_estimate  boolean NOT NULL DEFAULT false,
    is_deleted   boolean NOT NULL DEFAULT false,
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_log_account_day_idx ON app.food_log (account_id, logged_at);
CREATE INDEX IF NOT EXISTS food_log_sync_idx ON app.food_log (account_id, updated_at);

CREATE TABLE IF NOT EXISTS app.exercise (
    id            text PRIMARY KEY,               -- free-exercise-db slug, or a generated id for custom
    name          text NOT NULL,
    muscles       jsonb,
    equipment     text,
    instructions  jsonb,
    image_urls    jsonb,
    is_custom     boolean NOT NULL DEFAULT false,
    account_id    uuid REFERENCES app.account(id) ON DELETE CASCADE   -- set only when is_custom
);

CREATE TABLE IF NOT EXISTS app.program (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  uuid REFERENCES app.account(id) ON DELETE CASCADE,    -- null = built-in program
    name        text NOT NULL,
    description text
);

CREATE TABLE IF NOT EXISTS app.program_day (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id  uuid NOT NULL REFERENCES app.program(id) ON DELETE CASCADE,
    day_index   int NOT NULL,
    name        text NOT NULL                     -- e.g. Push, Pull, Legs, Rest
);

CREATE TABLE IF NOT EXISTS app.program_exercise (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_day_id  uuid NOT NULL REFERENCES app.program_day(id) ON DELETE CASCADE,
    exercise_id     text NOT NULL REFERENCES app.exercise(id),
    position        int NOT NULL,
    target_sets     int NOT NULL DEFAULT 3,
    target_reps     text                           -- e.g. 8-12 style range
);

CREATE TABLE IF NOT EXISTS app.workout_session (
    id              uuid PRIMARY KEY,
    account_id      uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    program_day_id  uuid REFERENCES app.program_day(id),
    started_at      timestamptz NOT NULL,
    ended_at        timestamptz,
    is_deleted      boolean NOT NULL DEFAULT false,
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_session_sync_idx ON app.workout_session (account_id, updated_at);

CREATE TABLE IF NOT EXISTS app.workout_set (
    id          uuid PRIMARY KEY,
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    session_id  uuid NOT NULL REFERENCES app.workout_session(id) ON DELETE CASCADE,
    exercise_id text NOT NULL REFERENCES app.exercise(id),
    set_no      int NOT NULL,
    reps        int NOT NULL,
    weight_kg   numeric NOT NULL DEFAULT 0,
    rpe         numeric,
    is_warmup   boolean NOT NULL DEFAULT false,
    is_deleted  boolean NOT NULL DEFAULT false,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_set_session_idx ON app.workout_set (session_id);
CREATE INDEX IF NOT EXISTS workout_set_sync_idx ON app.workout_set (account_id, updated_at);
-- PR lookups: best weight for an exercise over time.
CREATE INDEX IF NOT EXISTS workout_set_pr_idx ON app.workout_set (account_id, exercise_id, weight_kg DESC);

CREATE TABLE IF NOT EXISTS app.body_metric (
    id          uuid PRIMARY KEY,
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    metric_type text NOT NULL CHECK (metric_type IN ('weight_kg', 'waist_cm', 'chest_cm', 'arm_cm', 'photo')),
    value       numeric,
    photo_ref   text,                              -- local device path; uploaded only if user opts in (PRD section 7)
    recorded_at timestamptz NOT NULL,
    is_deleted  boolean NOT NULL DEFAULT false,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS body_metric_sync_idx ON app.body_metric (account_id, updated_at);

CREATE TABLE IF NOT EXISTS app.streak (
    account_id      uuid PRIMARY KEY REFERENCES app.account(id) ON DELETE CASCADE,
    current_length  int NOT NULL DEFAULT 0,
    last_logged_date date,
    freezes_used_this_week int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app.reminder (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('meal', 'workout', 'water')),
    time_of_day time NOT NULL,
    is_enabled  boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS app.chat_message (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    role        text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content     text NOT NULL,
    tool_calls  jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_message_account_idx ON app.chat_message (account_id, created_at);

-- Cost-control ledger for the AI gateway (ARCHITECTURE.md section 5).
CREATE TABLE IF NOT EXISTS app.ai_usage (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    feature     text NOT NULL CHECK (feature IN ('meal_parse_text', 'meal_parse_image', 'coach_chat', 'plan_generate')),
    tokens_in   int,
    tokens_out  int,
    cost_usd    numeric,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_account_day_idx ON app.ai_usage (account_id, created_at);

-- DPDP audit trail (PRD section 7 / ARCHITECTURE.md section 8).
CREATE TABLE IF NOT EXISTS app.consent_record (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id     uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    purpose        text NOT NULL,
    granted_at     timestamptz,
    revoked_at     timestamptz,
    policy_version text NOT NULL
);
