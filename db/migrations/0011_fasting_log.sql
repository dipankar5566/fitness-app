-- Intermittent fasting - the eighth syncable table. Mandatory syncable shape
-- (id/account_id/is_deleted/updated_at, ARCHITECTURE.md §3) plus server_updated_at as the pull
-- cursor, same as 0009_water_log.sql. One row per fast: ended_at is NULL while the fast is active.
-- target_minutes is capped at 23h (12h minimum) as a safety rail - the app's presets stop at 20h and
-- there is deliberately no multi-day fasting (packages/shared/src/fasting.ts). Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.fasting_log (
    id                 uuid PRIMARY KEY,
    account_id         uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    started_at         timestamptz NOT NULL,
    ended_at           timestamptz,
    target_minutes     integer NOT NULL CHECK (target_minutes BETWEEN 720 AND 1380),
    is_deleted         boolean NOT NULL DEFAULT false,
    updated_at         timestamptz NOT NULL DEFAULT now(),
    server_updated_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR ended_at > started_at)
);
CREATE INDEX IF NOT EXISTS fasting_log_sync_idx ON app.fasting_log (account_id, updated_at);
CREATE INDEX IF NOT EXISTS fasting_log_server_sync_idx ON app.fasting_log (account_id, server_updated_at);
