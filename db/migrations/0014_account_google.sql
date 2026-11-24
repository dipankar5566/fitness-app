-- Adds Google Sign-In as a real auth method alongside guest auth (ARCHITECTURE.md section 8).
-- google_sub is the stable Google identity key (the ID token's `sub` claim) - unique so a second
-- sign-in with the same Google identity always resolves to the same app.account row. email is
-- stored for display only (e.g. the Me tab's "Signed in as ...") and is never sent to analytics.
ALTER TABLE app.account ADD COLUMN IF NOT EXISTS google_sub text UNIQUE;
