-- Gives app.custom_food/app.custom_food_ingredient the full syncable shape (ARCHITECTURE.md section
-- 3), same as food_log in 0003_sync_cursor.sql, so custom foods/recipes can go through /sync like
-- every other table instead of a separate CRUD surface. Both tables are confirmed unused (zero rows
-- anywhere) so account_id can be added NOT NULL directly on custom_food_ingredient with no backfill.
-- Idempotent: safe to re-run.
ALTER TABLE app.custom_food ADD COLUMN IF NOT EXISTS server_updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS custom_food_server_sync_idx ON app.custom_food (account_id, server_updated_at);

ALTER TABLE app.custom_food_ingredient ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES app.account(id) ON DELETE CASCADE NOT NULL;
ALTER TABLE app.custom_food_ingredient ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE app.custom_food_ingredient ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app.custom_food_ingredient ADD COLUMN IF NOT EXISTS server_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS custom_food_ingredient_server_sync_idx ON app.custom_food_ingredient (account_id, server_updated_at);
CREATE INDEX IF NOT EXISTS custom_food_ingredient_parent_idx ON app.custom_food_ingredient (custom_food_id);
