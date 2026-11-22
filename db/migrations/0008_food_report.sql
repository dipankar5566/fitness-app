-- User-submitted food reports: "I searched and couldn't find X" (missing) or "this food's numbers
-- look wrong" (wrong_nutrients). A one-way submission queue reviewed out-of-band (psql in v1, no
-- moderation UI yet) - NOT a syncable table, so it deliberately does not carry the id/account_id/
-- is_deleted/updated_at sync shape; the client only ever POSTs to it.
-- food_ref is an indb food code (for wrong_nutrients) and stays a plain text reference with no FK,
-- same polymorphic convention as app.food_log.food_ref. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.food_report (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('missing', 'wrong_nutrients')),
    query       text,                 -- the search term that returned nothing (for 'missing')
    food_ref    text,                 -- the indb food code the user flags (for 'wrong_nutrients')
    note        text,                 -- optional free-text detail from the user
    status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewed', 'actioned', 'rejected')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_report_triage ON app.food_report (status, created_at);
