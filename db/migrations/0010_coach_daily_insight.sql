-- One cached AI "daily insight" per account per day, shown on the Today screen. Kept in its own
-- table (not app.chat_message) so it never leaks into the coach conversation history that
-- CoachService.getHistory feeds back to the model. The cache is what makes the insight cost at
-- most one AI call per account per day (CoachService.dailyInsight returns the cached row on a
-- same-day hit without calling the model). Not syncable (server-derived, re-creatable), so it does
-- not carry the id/is_deleted/updated_at sync shape. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.coach_daily_insight (
    account_id    uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    insight_date  date NOT NULL,
    content       text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, insight_date)
);
