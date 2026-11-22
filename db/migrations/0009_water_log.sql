-- Water intake logging - the seventh syncable table. Follows the mandatory syncable shape
-- (id/account_id/is_deleted/updated_at, ARCHITECTURE.md §3) plus server_updated_at as the pull
-- cursor (same as 0003 added to the earlier tables; included directly here since this table is new).
-- One row per drink event (amount_ml at recorded_at) so it stays append/sync-friendly rather than a
-- single mutable daily counter. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.water_log (
    id                 uuid PRIMARY KEY,
    account_id         uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    amount_ml          numeric NOT NULL,
    recorded_at        timestamptz NOT NULL,
    is_deleted         boolean NOT NULL DEFAULT false,
    updated_at         timestamptz NOT NULL DEFAULT now(),
    server_updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_log_sync_idx ON app.water_log (account_id, updated_at);
CREATE INDEX IF NOT EXISTS water_log_server_sync_idx ON app.water_log (account_id, server_updated_at);
