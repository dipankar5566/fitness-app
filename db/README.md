# db — migrations

Plain numbered SQL files applied in order by `migrate.ts`, tracked in `app.schema_migrations`.
No ORM migration DSL: keeps the existing `indb` schema file reusable byte-for-byte (0001_indb.sql
is a verbatim copy of `../indb/schema.sql`, per ARCHITECTURE.md).

## Files
- `0001_indb.sql` — the food database schema (recipes, nutrients, search) from `../indb/`. Schema only;
  does not load data. CREATE ... IF NOT EXISTS, so running it against the existing local `indb` database
  (which already has data loaded) is a safe no-op.
- `0002_app_schema.sql` — new `app` schema: accounts, profile, goals, food_log, packaged_food, custom
  foods, workouts/exercises/programs, body metrics, streaks, reminders, chat, AI usage ledger, consent
  records (ARCHITECTURE.md section 2).
- `0003_sync_cursor.sql` — adds `server_updated_at` to every syncable table, used only as the
  `GET /sync?since=` pull cursor (ARCHITECTURE.md section 3) - separate from the client-set
  `updated_at` that drives last-write-wins.

## Two supported setups
1. **Reuse the existing local `indb` database** (fastest for development; already has real recipe
   and ingredient data loaded by `../indb/load.py`):
   ```
   DATABASE_URL=postgresql://postgres@localhost:5432/indb pnpm migrate
   ```
   This only adds the new `app` schema; the `indb` tables are already present and untouched.
2. **A fresh database** (CI, a clean environment, or production): create the database, run both
   migrations, then separately run `../indb/load.py` (and `usda_load.py`, `aliases.py`) against it to
   populate real food data — those scripts already read `PGHOST`/`PGPORT`/`PGUSER`/`PGDATABASE`.

## Usage
```
pnpm install
DATABASE_URL=postgresql://postgres@localhost:5432/indb pnpm migrate
```
Password: via `PGPASSWORD`/`pgpass.conf` (same as `../indb/`), never embedded in `DATABASE_URL` in
committed config.
