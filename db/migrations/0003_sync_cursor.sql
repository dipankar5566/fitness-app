-- Sync pull cursor (ARCHITECTURE.md section 3). `updated_at` is set by the client so last-write-wins
-- reflects when the user actually made the edit - that makes it unsafe as the GET /sync?since= cursor,
-- since an offline device can push an edit with an old `updated_at` long after the server has moved on.
-- `server_updated_at` is set by the server on every insert/update and used only for the pull cursor.
-- Idempotent: safe to re-run against a database that already has 0002_app_schema.sql applied.
ALTER TABLE app.food_log ADD COLUMN IF NOT EXISTS server_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app.workout_session ADD COLUMN IF NOT EXISTS server_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app.workout_set ADD COLUMN IF NOT EXISTS server_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE app.body_metric ADD COLUMN IF NOT EXISTS server_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS food_log_server_sync_idx ON app.food_log (account_id, server_updated_at);
CREATE INDEX IF NOT EXISTS workout_session_server_sync_idx ON app.workout_session (account_id, server_updated_at);
CREATE INDEX IF NOT EXISTS workout_set_server_sync_idx ON app.workout_set (account_id, server_updated_at);
CREATE INDEX IF NOT EXISTS body_metric_server_sync_idx ON app.body_metric (account_id, server_updated_at);
