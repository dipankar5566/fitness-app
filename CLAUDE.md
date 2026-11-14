# CLAUDE.md — working rules for this repo

Fitness + nutrition app for Indian gym-goers. Full product context: `docs/PRD.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`. This file is the quick-reference a session needs
without re-reading those three docs every time.

## Current status (read this first)

**M1 (Foundations) is mostly done.** Verified end-to-end against the real local Postgres `indb`
database: server boots, `POST /auth/guest` creates a real account row, `GET /food/search?q=idli`
returns real INDB recipe matches. `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass at the repo
root. CI workflow exists (`.github/workflows/ci.yml`).

**Still open in M1** (do these next, in this order):
1. `apps/mobile` — Expo (TypeScript) skeleton: navigation shell, guest-auth flow calling
   `POST /auth/guest` on the API, local `expo-sqlite` wired up (empty for now — M2 adds real sync).
2. Analytics + crash reporting — wire a provider (PostHog or Sentry are the usual low-friction
   choices; nothing chosen yet) with no PII in events, per PRD section 7.
3. Once both land, M1 is complete — move to M2 (`docs/ROADMAP.md`): onboarding -> target
   calculation UI -> food search/log UI -> offline sync v1 for `food_log`.

**Known issue to carry forward**: Vitest is esbuild-based and esbuild does not emit TypeScript's
`emitDecoratorMetadata`. NestJS constructor injection relies on that metadata. Today's only test
(`HealthController`) has no injected dependencies, so it is unaffected - but the first test for
`AuthService` or `FoodController` (both take constructor-injected services) will fail the same way
the API itself did (see "Architecture rules" below) unless Vitest is configured with
`unplugin-swc` (or similar) first, or the test uses explicit `@Inject()` tokens. Fix this *before*
writing those tests in M2, not after they mysteriously fail.

## Repo map

```
apps/
  api/                 NestJS API (TypeScript, ESM). src/<feature>/*.controller.ts,
                       *.service.ts, *.module.ts. dev script uses tsc-watch, NOT tsx (see below).
  mobile/              Expo app (TypeScript). Not yet scaffolded - next up.
packages/
  shared/              Pure TS: nutrition/target formulas (targets.ts) and Zod schemas
                       (schemas.ts) shared by apps/api and apps/mobile. No I/O, no framework deps.
db/
  migrations/          Plain numbered .sql files, applied in order by migrate.ts.
                       0001_indb.sql = verbatim copy of indb/schema.sql (do not hand-edit here -
                       edit indb/schema.sql and re-copy, so the two never drift).
                       0002_app_schema.sql = the new `app` schema (accounts, goals, food_log,
                       workouts, programs, body metrics, streaks, chat, AI usage, consent).
  migrate.ts           Dependency-light runner; tracks applied files in app.schema_migrations.
indb/                  Standalone tooling that built the INDB (CC BY) + USDA (CC0) food database
                       now loaded into the shared local Postgres `indb` database. Mature and
                       working - treat as read-only reference unless explicitly asked to change it.
healthifyme-re/        Static teardown of a competitor app. Reference for ideas/architecture
                       patterns ONLY. Never copy code, data, assets or strings from it into the
                       app; it is not a dependency of anything under apps/ or packages/.
docs/
  PRD.md               Product requirements, personas, feature acceptance criteria, DPDP/legal.
  ARCHITECTURE.md       System design, full data model, sync protocol, AI gateway, hosting options.
  ROADMAP.md            12-week milestone plan (M1-M6) with exit criteria and cut-lines.
.github/workflows/ci.yml   lint + typecheck + test on push/PR.
eslint.config.mjs      Single root-level flat config. Do not add per-package ESLint configs or
                       devDependencies - pnpm is strict about phantom deps, so eslint lives only
                       at the workspace root and `pnpm lint` (= `eslint .`) covers everything.
```

## Architecture rules

- **Two Postgres schemas in one database, deliberately.** `public` holds the `indb` food data
  (CC BY / CC0 - recipes, ingredients, nutrients, `search_foods()`), applied once by
  `0001_indb.sql` and otherwise **read-only from app code**. `app` holds everything the app owns.
  Never add a new table to `public`; never make `app.*` tables reference `indb` rows via a real FK
  constraint (the relationship is polymorphic - `food_source` + `food_ref` - see
  `app.food_log`/`app.custom_food_ingredient`).
- **Open Food Facts data stays in `app.packaged_food`, never in the `indb`-derived tables.** OFF
  is ODbL (share-alike); INDB/USDA are CC BY/CC0. Mixing them into one table would pull OFF's
  share-alike obligation onto data that currently is not subject to it.
- **Syncable tables follow one shape, no exceptions**: `id uuid` (client-generated, not a serial -
  it has to work while offline), `account_id`, `is_deleted boolean`, `updated_at timestamptz`.
  See `app.food_log`, `app.workout_session`, `app.workout_set`, `app.body_metric` for the pattern.
  A new syncable table that skips any of these four columns breaks the generic `/sync` endpoint
  design in `ARCHITECTURE.md` section 3 - do not special-case it instead of following the shape.
- **No ORM yet.** `apps/api/src/database/database.service.ts` is a thin `pg.Pool` wrapper. Plain
  SQL in controllers/services is intentional at this stage (ARCHITECTURE.md section 2 leaves
  Prisma/Drizzle as a later option) - do not introduce an ORM for one feature while the rest
  stays raw SQL.
- **`apps/api` dev/build must go through real `tsc`, not esbuild/tsx.** `tsc-watch` is the dev
  script for exactly this reason (see "Known issue" above). Do not change `apps/api`'s dev script
  back to `tsx watch` - it will reintroduce the silent `undefined` constructor-injection bug.
- **AI gateway is provider-agnostic by contract**, not by convention: new AI features implement the
  `AiProvider` interface sketched in `ARCHITECTURE.md` section 5 and go through it. No feature
  calls an AI SDK directly from a controller/service.
- **Guest-first auth**: every feature must work for a guest account (`app.account.is_guest = true`).
  Do not gate core logging/workout/target features behind "has a real account."

## Naming conventions

- **TypeScript**: `camelCase` for variables/functions, `PascalCase` for classes/types/interfaces,
  `SCREAMING_SNAKE_CASE` only for true constants (e.g. `KCAL_PER_G_PROTEIN` in `targets.ts`).
  Zod schemas are named `<thing>Schema` (e.g. `foodLogEntrySchema`), inferred types are
  `type <Thing> = z.infer<typeof <thing>Schema>` directly below the schema.
- **Files (apps/api)**: Nest convention, `<feature>.<role>.ts` - `food.controller.ts`,
  `food.module.ts`, `auth.service.ts`, `jwt-auth.guard.ts`. One feature per `src/<feature>/`
  directory. Tests are `<file>.test.ts` next to the file they test (not `.spec.ts`, not a
  separate `__tests__/` directory - this repo chose `.test.ts` when it hand-rolled Nest without
  `nest-cli`; stay consistent with it rather than mixing conventions).
- **Database**: singular, `snake_case` table and column names (`food_log`, not `food_logs` or
  `FoodLog`). Foreign keys are `<referenced_table>_id`. Booleans are `is_<adjective>` or
  `has_<noun>`. Every new `app.*` table and index name must be prefixed implicitly by living in
  the `app` schema - do not repeat `app_` in the table name itself.
- **Env vars**: `UPPER_SNAKE_CASE`, documented in the nearest `.env.example` (see
  `apps/api/.env.example`, `db/README.md`). Never commit a real secret, even a dev one, to a
  tracked `.env` file - `.gitignore` already excludes `.env`/`.env.local`.
- **Migrations**: `NNNN_description.sql`, zero-padded four digits, strictly increasing, one
  logical change per file. Every statement uses `CREATE ... IF NOT EXISTS` / `ADD COLUMN IF NOT
  EXISTS` so a migration is safe to re-run (see `db/README.md` for why - the existing `indb`
  database already has data and `0001_indb.sql` must be a safe no-op against it).

## Test expectations

- **Vitest everywhere** (`packages/shared`, `apps/api`, and `apps/mobile` once scaffolded). No
  Jest, no mixing test runners between packages.
- **`packages/shared` formulas must stay pure and fully unit-tested.** Every target/macro formula
  needs a test asserting the *relationship* the PRD specifies (e.g. "cut kcal less than TDEE",
  "training day carbs greater than rest day carbs at the same weekly kcal"), not just a
  hard-coded expected number - see `targets.test.ts` for the pattern to follow.
- **`apps/api` controllers/services**: use `@nestjs/testing`'s `Test.createTestingModule`. Mock
  `DatabaseService` rather than hitting a real Postgres connection in unit tests - no test in CI
  should require a live database (there is no test-database service in `ci.yml` yet; adding one
  is a deliberate future decision, not an accident to fall into by writing a test that needs it).
- **Before considering any feature "done"**: `pnpm lint && pnpm typecheck && pnpm test` must pass
  at the repo root (this is also exactly what `.github/workflows/ci.yml` runs).
- **Manual end-to-end smoke tests** (booting the API, curling endpoints) are good for verifying
  new features during development, but are not a substitute for a committed automated test -
  M1's manual guest-account/food-search verification should eventually get a real `AuthService`/
  `FoodController` test once the decorator-metadata issue above is resolved.

## Commands

```
pnpm install                 # from repo root, after any package.json change
pnpm lint                    # eslint . (single root config)
pnpm typecheck                # turbo run typecheck (per-package tsc --noEmit)
pnpm test                     # turbo run test (per-package vitest run)

# db (run from db/, needs the password available via PGPASSWORD or pgpass.conf, never inline)
DATABASE_URL=postgresql://postgres@localhost:5432/indb pnpm migrate

# apps/api (run from apps/api/; port 3000 is often taken by something else on this machine - use 3001)
DATABASE_URL=postgresql://postgres@localhost:5432/indb JWT_SECRET=<dev-secret> PORT=3001 pnpm dev
```
