# fitness-app (working title)

A free, no-nonsense nutrition + training app for Indian gym-goers: log an Indian meal in seconds
("2 roti, dal, paneer bhurji" typed, or a photo/barcode), hit your protein target, and run a real
workout logger — without the upsell walls of HealthifyMe or the thin Indian-food coverage of
MyFitnessPal/Cronometer.

> Branding isn't finalised yet (due end of M6 per the roadmap) — `<AppName>` in `docs/` is a
> placeholder, not a typo. Built from scratch; a static teardown of a competitor app
> (`healthifyme-re/`) only informed UI/architecture ideas — no code, data, assets or strings from
> it were copied into this app.

## Status

**M1–M4 are done; M5 is in progress.** See [`CLAUDE.md`](CLAUDE.md) for the detailed,
continuously-updated log of exactly what's built and verified, and [`docs/ROADMAP.md`](docs/ROADMAP.md)
for the full 12-week plan.

| Milestone | Scope | Status |
|---|---|---|
| M1 — Foundations | Monorepo, API skeleton, mobile skeleton, guest auth, CI, crash/analytics | ✅ Done |
| M2 — Nutrition core | Onboarding + targets, food search/logging, diet filtering, custom foods, offline sync | ✅ Done |
| M3 — Workouts | Exercise library, offline workout logger, PRs, built-in programs + "follow program" | ✅ Done |
| M4 — AI meal logging + barcode | AI gateway, text/photo meal parsing, barcode → Open Food Facts, usage quota | ✅ Done |
| M5 — AI coach, Health Connect, reminders | Coach chat + safety guardrails done; Health Connect, reminders/streaks, coach UI still pending | 🚧 In progress |
| M6 — Hardening, compliance, closed beta | Sync stress tests, DPDP compliance, Play closed beta | ⏳ Not started |

A cross-cutting UI/UX redesign (bottom tabs, design tokens, reusable components) landed across
every mobile screen ahead of M6, informed by the same competitor teardown referenced above.

## Tech stack

- **API** — NestJS (TypeScript, ESM), plain SQL over `pg` (no ORM), JWT guest auth
- **Mobile** — Expo (TypeScript, SDK 58), React Navigation, `expo-sqlite` offline mirror + custom sync engine
- **Shared** — pure TypeScript formulas/schemas (`packages/shared`), Zod, no I/O
- **Database** — PostgreSQL: a read-only `public` schema (INDB/USDA Indian food data, CC BY / CC0)
  alongside an `app` schema the product owns
- **AI** — OpenAI (`gpt-4o-mini` for meal parsing, `gpt-4o` for the coach) behind a provider-agnostic gateway
- **Tooling** — pnpm workspaces + Turborepo, Vitest, ESLint (single root config), GitHub Actions CI

## Repo structure

```
apps/
  api/        NestJS API — auth, profile, food, food-log, sync, exercise, program, ai, packaged-food, coach
  mobile/     Expo app — bottom-tab navigation, offline-first SQLite, every logging/workout/coach flow
packages/
  shared/     Pure TS: target/macro formulas, diet classification, meal-summary math, Zod schemas
db/           Numbered SQL migrations + seed/import scripts (exercises, programs, diet classification)
indb/         Standalone tooling that built the Indian food database (INDB CC BY + USDA CC0) — read-only reference
healthifyme-re/  Static reverse-engineering notes on a competitor app — ideas/reference only, not a dependency
docs/         PRD.md, ARCHITECTURE.md, ROADMAP.md — full product/engineering context
```

See [`CLAUDE.md`](CLAUDE.md) for the authoritative, up-to-date repo map, architecture rules,
naming conventions, and known traps (Windows native-build paths, pnpm hoisting, etc.) — it's kept
current every session and is the fastest way to orient in this codebase.

## Getting started

Prerequisites: Node ≥ 20, pnpm 12.6, a local PostgreSQL instance.

```bash
pnpm install

# Apply migrations against your local Postgres (see db/README.md for the two supported setups)
cd db
DATABASE_URL=postgresql://postgres@localhost:5432/indb pnpm migrate
cd ..

# Run the API (port 3000 is often taken locally — use 3011; 3001 is reserved by another app on this machine)
cd apps/api
DATABASE_URL=postgresql://postgres@localhost:5432/indb JWT_SECRET=<dev-secret> PORT=3011 pnpm dev
```

```bash
# Run the mobile app (separate terminal, from apps/mobile)
pnpm start      # or: pnpm android / pnpm ios
```

> **Windows native Android builds**: `pnpm-workspace.yaml` needs `nodeLinker: hoisted` (already
> set) to stay under Windows' 260-character path limit, and some workspace `.bin` shims break
> under that layout — see `CLAUDE.md`'s "Known trap" sections for the exact workaround.

## Common commands

```bash
pnpm lint          # eslint . (single root config, covers every package)
pnpm typecheck     # turbo run typecheck
pnpm test          # turbo run test (Vitest everywhere)
```

All three must pass before a feature is considered done — this is also exactly what
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push/PR.

## Documentation

- [`docs/PRD.md`](docs/PRD.md) — product requirements, personas, feature acceptance criteria, DPDP/legal
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, data model, offline sync protocol, AI gateway
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — 12-week milestone plan with exit criteria and cut-lines
- [`CLAUDE.md`](CLAUDE.md) — working rules and current status for anyone (human or agent) picking up this repo

## License

Not yet decided — no `LICENSE` file is present. Third-party data has its own terms, respected as-is:
INDB (CC BY), USDA (CC0), Open Food Facts (ODbL), free-exercise-db (Unlicense/public domain).
