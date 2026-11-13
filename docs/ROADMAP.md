# <AppName> — 12-Week Roadmap (solo dev + Claude)

Beta = all four pillars live in a **lean** form. Fuller versions (voice logging, social feed, friends,
advanced AI plans) are **weeks 13–24**, not blocking the beta.

## M1 (Weeks 1–2) — Foundations
Scope: monorepo scaffold (pnpm + Turborepo), `apps/api` NestJS skeleton + Postgres via Docker, import
`indb` schema unchanged, new `app` schema migration, `apps/mobile` Expo skeleton + navigation shell,
guest auth (device-bound JWT), CI (lint/typecheck/test), analytics + crash reporting wired (no PII).
Exit criteria: app boots, guest account created, can read a food from `indb` through the API, CI green.
Risks: environment setup eating days 1–3 → timebox to 2 days, use Docker compose from day 1.

## M2 (Weeks 3–4) — Nutrition core
Scope: onboarding flow (profile, diet type, goal) → target formulas (`packages/shared`, unit-tested);
food search (English first; multilingual verified, not UI-polished) over `indb` + local SQLite cache;
log/edit/delete meal (manual entry); diet-type filtering; custom foods/recipes; offline logging + `/sync`
v1 for `food_log`.
Exit criteria: a user can onboard, get targets, search a food in English, log a meal offline, and see it
after reconnecting. Unit tests on target formulas pass.
Cut-line if behind: custom recipes → M6/Later; keep core log + targets.

## M3 (Weeks 5–6) — Workouts
Scope: import free-exercise-db into `exercise` table + image hosting; exercise library + filters;
workout session logger (sets/reps/weight) fully offline, same `/sync` protocol extended to workout tables;
PRs (Epley 1RM, rep PRs); 3 built-in programs (PPL, upper/lower, full-body) + home/no-equipment program;
"follow program" flow.
Exit criteria: user can pick a program, log today's session offline, see history and a PR. **AI provider
decision due end of this milestone** (needed for M4).
Cut-line: AI-generated programs → M5/Later; ship with built-in programs only.

## M4 (Weeks 7–8) — AI meal logging + barcode
Scope: AI gateway interface + chosen provider wired; text-based meal parse → draft → confirm → log
(Hinglish tested); photo-based meal parse (single photo, confirm screen); barcode scan → Open Food Facts
lookup → `packaged_food` table (ODbL, separate from `indb`); AI usage ledger + daily quota.
Exit criteria: "2 roti aur dal" and a labelled meal photo both produce a correct, editable draft that
saves to the real food log; barcode scan returns a product or a clear "not found, add it" flow.
Cut-line: voice input → post-beta; restaurant-dish AI estimates → M5/Later if time-constrained.

## M5 (Weeks 9–10) — AI coach, Health Connect, reminders
Scope: coach chat grounded in user's targets/logs/workouts, with actionable suggestions; safety guardrails
(deficit floor, ED-signal flag, medical disclaimer) tested with adversarial prompts; Health Connect read
(steps/exercise/weight) + opt-in write; meal/workout reminders + logging streak.
Exit criteria: coach answers 10 scripted test questions correctly and refuses 5 scripted unsafe prompts;
Health Connect read works on a real device; a reminder fires and a streak increments/resets correctly.
Cut-line: AI-generated weekly plans (vs. coach ad-hoc advice) → Later if time-constrained.

## M6 (Weeks 11–12) — Hardening, compliance, closed beta
Scope: offline-sync stress tests (airplane-mode flows, conflicting edits, long offline periods); progress
screens (weight trend, measurements, photos — local by default, strength graphs); share-a-PR card image;
DPDP pass (consent screens + records, export/delete endpoints, data-safety form, 18+ gate); crash/perf
polish; **hosting decision executed**, deploy; Play internal → closed testing release; app name/brand
finalised and applied.
Exit criteria: closed beta live on Play with real testers; export & delete both work end-to-end; zero
P0 bugs open; crash-free ≥ 99 % in internal testing.

## Post-beta (Weeks 13–24, not blocking beta)
Voice meal logging · social (friends, gym groups, feed) · AI-generated weekly workout + meal plans ·
restaurant-chain dish database expansion · revenue model implementation · iOS · regional-language UI ·
IFCT 2017 integration (pending NIN permission) · advanced analytics dashboards.

## Standing risks
- **AI cost overrun** — mitigate with quota + caching from M4; review weekly `ai_usage` totals.
- **Indian-dish parse accuracy** — build a 50-item Hinglish test set in M4, re-run every provider change.
- **Solo-dev bandwidth** — every milestone has a stated cut-line; protect M1–M4 (the four pillars) over polish.
- **DPDP scope creep** — rules fully bite 13 May 2027, but beta ships compliant now to avoid rework.

## Decision deadlines (mirrors PRD §9)
AI provider — end of week 6 · Hosting — end of week 10 · App name/brand — week 11 · Revenue model — post-beta.
