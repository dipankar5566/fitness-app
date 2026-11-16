# <AppName> — Architecture (v0.1)

## 1. System overview
```
┌─────────────────────┐        offline-first sync        ┌──────────────────────┐
│  Expo RN app (TS)    │◄─────────────────────────────────►│  NestJS API (TS)     │
│  local SQLite        │   REST + OpenAPI, JWT             │  (stateless, scaled   │
│  (expo-sqlite)        │                                   │   horizontally)       │
└──────────┬───────────┘                                    └──────────┬────────────┘
           │ Health Connect (read steps/exercise/weight;               │
           │ write workouts, opt-in)                                   │ AI Gateway (provider-agnostic)
           ▼                                                            ▼
   Android Health Connect                                     ┌────────────────────┐
                                                                │ LLM/vision provider │
                                                                │ (deferred choice)   │
                                                                └────────────────────┘
                                                                           │
                                                                           ▼
                                                                ┌────────────────────┐
                                                                │ PostgreSQL          │
                                                                │  - indb schema      │
                                                                │    (reused as-is)   │
                                                                │  - app schema (new) │
                                                                └────────────────────┘
```
Monorepo (pnpm workspaces + Turborepo):
```
apps/mobile      Expo (TypeScript), React Navigation, TanStack Query, expo-sqlite, Zod
apps/api         NestJS (TypeScript), Prisma (or node-postgres + Drizzle), Zod DTOs
packages/shared  Zod schemas, DTO types, nutrition/target formulas, sync protocol types
db/              SQL migrations: 00_indb (import existing D:\fitness\indb\schema.sql verbatim),
                 01_app (new tables below), seed scripts (free-exercise-db import)
infra/           Dockerfile(s), docker-compose.yml (postgres + api), CI config
```

## 2. Data model (new `app` schema; `indb` schema reused unchanged)
- **account**: id, phone/email (nullable until upgraded), auth_provider, is_guest, created_at, deleted_at
- **profile**: account_id, sex, dob, height_cm, activity_level, diet_type (veg/eggetarian/non_veg/vegan/jain),
  consent_health_data (timestamptz + version — DPDP record)
- **goal**: account_id, mode (bulk/cut/recomp/maintain), target_kcal, target_protein_g, target_carb_g,
  target_fat_g, training_day_adjustment_pct, started_at, is_active
- **food_log**: id (uuid, client-generated), account_id, food_id (→ indb.food OR app.packaged_food OR
  app.custom_food via food_source enum + food_ref), quantity, unit, meal_type, logged_at, source
  (manual/ai_text/ai_photo/barcode), is_estimate, is_deleted, is_synced, updated_at — **mirrors INDB's
  proven sync shape**: client/local id, soft delete, dirty flag
- **packaged_food**: barcode, name, brand, nutrients jsonb, source ('off'|'user_submitted'), review_status
  — **separate table/schema from `indb`**: Open Food Facts is ODbL (share-alike); keeping it out of the
  CC BY/CC0 `indb` tables avoids licence contamination
- **custom_food**, **custom_food_ingredient**: user-built foods/recipes (quantity × ingredient → kcal/macros)
- **exercise**: from free-exercise-db (id, name, muscles, equipment, instructions, image_urls, is_custom)
- **program**, **program_day**, **program_exercise**: built-in + user programs
- **workout_session**, **workout_set**: session(account_id, program_day_id?, started_at, ended_at),
  set(session_id, exercise_id, set_no, reps, weight_kg, rpe, is_warmup) — same sync shape as food_log
- **body_metric**: weight/measurements/photo_ref over time
- **streak**, **reminder**: as named
- **chat_message**: account_id, role, content, tool_calls jsonb, created_at
- **ai_usage**: account_id, feature, tokens/cost, created_at — cost ledger for quota enforcement
- **consent_record**: account_id, purpose, granted_at, revoked_at, policy_version — DPDP audit trail

## 3. Offline-first sync (pattern proven in the HealthifyMe teardown, reimplemented independently)
- Every syncable table: `id` is a client-generated UUID (works offline), `server_id` not needed since id
  *is* the server id; `is_deleted` soft delete; `updated_at`; `is_synced` local-only flag in SQLite.
- Mobile keeps local SQLite mirror of its own rows. On connectivity: `POST /sync` pushes an array of
  `{table, op: upsert|delete, row}` batched since last `sync_token`; server upserts (last-write-wins by
  `updated_at`, **except** rows the client marked dirty after the push started — client re-sends on next
  sync, avoiding the overwrite bug pattern the teardown flagged); server returns `{changes, next_sync_token}`
  for a `GET /sync?since=<token>` pull.
- Conflict rule: last-write-wins on `updated_at`, with the *push-in-flight* exception above. Simpler than the
  legacy/unified split seen in the teardown — one protocol, used for every table.
- **Implemented (v1, `food_log` only — see CLAUDE.md "Current status"):** the `GET /sync?since=` cursor is a
  separate server-set `server_updated_at` column, not `updated_at`. `updated_at` is client-set and drives
  last-write-wins, so a device can legitimately push an edit with an old `updated_at` long after reconnecting
  — using it as the pull cursor would make that edit invisible to a pull that already ran past that timestamp.
  `server_updated_at` is set by the server on every push and only ever used for the pull cursor.

## 4. API surface (NestJS modules, REST + OpenAPI via `@nestjs/swagger`)
`auth` (guest issue, OTP, Google, email/password, link-guest-to-account merge) · `profile` · `targets`
(compute formulas from `packages/shared`) · `food` (search, barcode lookup, custom-food CRUD) · `sync`
(generic push/pull per table) · `workouts` (exercise library, programs, sessions — logging itself goes
through `sync`) · `ai` (meal-parse, coach-chat, plan-generate — all through the AI gateway) · `health-connect`
(token exchange if needed; most HC access is on-device) · `admin` (packaged-food review queue).

## 5. AI gateway
```ts
interface AiProvider {
  parseMealText(text: string, ctx: UserContext): Promise<ParsedMeal>
  parseMealImage(image: Buffer, ctx: UserContext): Promise<ParsedMeal>
  chat(messages: ChatMessage[], ctx: UserContext, tools: ToolSpec[]): Promise<ChatResult>
  generatePlan(kind: 'workout'|'meal', input: PlanInput): Promise<Plan>
}
```
- One interface, swappable implementation (Anthropic/OpenAI/Gemini/local) — **provider decided by week 6**.
- `ParsedMeal` items are always resolved to a `food_id` in our DB (search-then-match, not free text) or
  explicitly flagged `is_estimate`; the gateway never writes to `food_log` directly — it returns a draft the
  app shows for confirmation (mirrors the "confirm before save" pattern from the teardown's Snap review step).
- Cost control: per-account daily quota row in `ai_usage`; response caching for identical text/photo hashes;
  cheap model for parse, higher-end model only for coach/plan generation; structured-output (JSON schema /
  tool calls) to avoid retries from malformed output.

## 6. Search
- Reuses `indb.search_foods()` (pg_trgm) across `food_name` (already multilingual-ready) + new
  `packaged_food`/`custom_food` tables unioned in a view; barcode is an exact-match lookup, not fuzzy.

## 7. Health Connect
- Expo module (`expo-health-connect` or custom native module) reads steps/exercise/weight on-device;
  writes workout sessions back (opt-in per data type, per DPDP consent granularity). No server-side HC token.

## 8. Security & DPDP
- JWT (short-lived) + refresh token; guest accounts get a device-bound JWT, upgraded on sign-up (merge by
  account_id reassignment, not data copy).
- `consent_record` written on every consent grant/revoke; `/account/export` and `/account/delete` endpoints
  (DPDP rights) — delete cascades with a 30-day soft-delete grace period then hard delete.
- PII minimised: phone/email only; no Aadhaar/health-ID; progress photos stored client-side by default,
  only uploaded if the user opts into backup (then encrypted at rest).
- India data residency: Postgres + storage in an India region (see §10).

## 9. Testing & CI
- `packages/shared`: unit tests for target formulas (Vitest).
- `apps/api`: unit tests (Vitest) + e2e against a test Postgres (Testcontainers or docker-compose).
- `apps/mobile`: component tests (Jest + RNTL); a handful of Detox/Maestro e2e flows (log a meal, log a set, offline→sync).
- GitHub Actions: lint + typecheck + test on PR; build Expo preview on merge to main.

## 10. Hosting options (beta scale, est. monthly, India-region)
| Option | Infra cost (beta, <1k MAU) | Notes |
|---|---|---|
| Fly.io / Railway + managed Postgres (Mumbai/Singapore) | ~$10–30 | fastest to set up, solo-dev friendly |
| Single VPS (Hetzner/DO, Bangalore/Mumbai via DO) + self-managed Postgres | ~$10–20 | cheapest, more ops work |
| AWS/GCP Mumbai (ECS/Cloud Run + RDS/Cloud SQL) | ~$40–100+ | best for scale-out later, more setup |
AI cost is separate and provider-dependent — estimate once a provider is chosen (week 6); budget a per-MAU
cap (`ai_usage` ledger) regardless of provider.
