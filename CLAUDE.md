# CLAUDE.md — working rules for this repo

Fitness + nutrition app for Indian gym-goers. Full product context: `docs/PRD.md`,
`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`. This file is the quick-reference a session needs
without re-reading those three docs every time.

## Current status (read this first)

**M1 (Foundations) is complete.** `apps/mobile` is scaffolded (Expo TypeScript SDK 58, React
Navigation, guest-auth flow persisted via `expo-secure-store`, `expo-sqlite` wired up empty) and
crash reporting + lightweight analytics are wired via Sentry (`src/lib/analytics.ts` - a no-op
until `EXPO_PUBLIC_SENTRY_DSN` is set, no PII/health values ever sent, PRD section 7).

**M2 (Nutrition core) is complete.** Done, each verified end-to-end against the real local
Postgres `indb` database (not just unit tests):
- Onboarding + target calculation: `PUT`/`GET /profile` (`apps/api/src/profile/`) computes and
  stores macro targets via `packages/shared`'s formulas; `apps/mobile`'s `OnboardingScreen` feeds
  it and `HomeScreen` displays the result.
- Food search + logging: `GET /food/:code` (`apps/api/src/food/`) fills the nutrient data
  `search_foods()` doesn't return; `POST/GET/PATCH/DELETE /food-log` (`apps/api/src/food-log/`)
  covers manual meal logging with server-computed macros. `apps/mobile`'s `FoodSearchScreen` ->
  `LogFoodScreen` -> `HomeScreen` flow is wired end-to-end.
- Offline-first logging + `/sync` v1: `apps/mobile/src/lib/db.ts` + `db-schema.ts` now open and
  migrate a real local SQLite mirror (`food_log`, `food_cache`, `kv`); `food-log-repo.ts` is the
  offline outbox (dirty flag, push-in-flight exception) that `LogFoodScreen`/`HomeScreen` read and
  write instead of calling the API directly; `sync-engine.ts`'s `syncNow` pushes dirty rows then
  pulls, triggered on app start, after every write, and on `AppState` foreground (`App.tsx`).
  `POST`/`GET /sync` (`apps/api/src/sync/`) implement the push/pull protocol against `food_log`
  only (workout/body-metric tables plug in the same way once their screens exist in M3) - **the
  pull cursor is `server_updated_at`, a server-set column added by `0003_sync_cursor.sql`, not the
  client-set `updated_at`** (which drives last-write-wins instead): a client can legitimately push
  an old `updated_at` long after reconnecting, so the pull cursor has to be independent of it.
  Verified end-to-end: idempotent-retry, stale-reject, not-owner-reject, delete, and incremental
  pull via curl against the real `indb` database, plus unit tests in both `apps/api` and
  `apps/mobile` (the mobile ones run real SQL against `node:sqlite`, not a mock, since expo-sqlite
  can't load outside React Native - see `node-sqlite-test-db.ts`).
- Custom foods/recipes, offline-capable: `app.custom_food`/`app.custom_food_ingredient` got the
  same sync shape as `food_log` (`0004_custom_food_sync.sql`), and `sync.service.ts`'s `push()`/
  `pull()` are now a small per-table adapter registry instead of being hardcoded to `food_log` -
  `custom_food`/`custom_food_ingredient` are the second and third tables wired into it (workout/
  body-metric tables join the same way once their M3 screens exist). Macros for a logged custom
  food are computed server-side exactly like an indb food - no new endpoint, no local macro cache:
  `enrichWithMacros` gained a `food_source === "custom"` branch that sums the recipe's indb-sourced
  ingredients and scales by the grams logged (nested custom/packaged sub-ingredients don't
  contribute macros, a documented v1 limitation). `apps/mobile`'s `MyFoodsScreen` (list/log/delete)
  and `CreateCustomFoodScreen` (name + ingredients, create-only - no edit flow in v1) read/write the
  new local `custom_food`/`custom_food_ingredient` tables via `custom-food-repo.ts`, following the
  same outbox pattern as `food-log-repo.ts`; `sync-engine.ts` pushes/pulls all three tables in one
  round trip. Verified end-to-end via curl (push a recipe + ingredient, log it, pull, confirm the
  computed macros match hand-calculated values from the ingredient's per-100g nutrients) plus unit
  tests in both apps.

- Diet-type filtering: `app.food_diet_class` (`0005_food_diet_class.sql`) holds a heuristic
  veg/vegan/egg/non_veg + Jain-suitability classification per `indb` food code - **deliberately not
  a column on `public.food`**, since that schema is read-only from app code and `indb/load.py`
  truncates/reloads it on every reload. Backfilled by `db/backfill-diet-class.ts`
  (`pnpm backfill:diet`, re-runnable) using the pure classifier in `packages/shared/src/diet.ts`
  (`classifyFood`/`allowedDietClasses`/`isAllowed`) - for a recipe it reads not just the dish name
  but every `recipe_ingredient` line, which is what correctly classifies e.g. "Chicken biryani" as
  `non_veg`. A food with no classification signal comes back `null` ("unverified"), never excluded
  by a guess. `GET /food/search` takes an optional `dietType` query param (`FoodService.search`
  over-fetches from `search_foods()` then filters in application code, since the Postgres function
  itself has no diet awareness); `apps/mobile`'s `FoodSearchScreen` reads the diet type from the
  cached profile and applies the same filter to its offline recent-foods fallback. Verified
  end-to-end via curl (`chicken`/`biryani` searches filtered by `dietType=veg` vs `non_veg`) and a
  psql spot-check of the backfill's classification output, plus unit tests in both `apps/api` and
  `packages/shared`.

All three M2 roadmap items (`docs/ROADMAP.md`) - diet-type filtering, custom foods/recipes,
offline logging + `/sync` v1 - are done.

**M3 (Workouts) is complete.** First roadmap item: `app.exercise` (schema already existed
from `0002_app_schema.sql`) is populated by `db/import-exercises.ts` (`pnpm import:exercises`) from
**free-exercise-db** (Unlicense/public domain, 876 exercises, PRD section 5.4/8), pinned to a
specific commit SHA so a re-run can't silently change the dataset underneath us - verified against
the real `indb` database (876 rows, idempotent re-run, spot-checked muscles/equipment/image_urls
via psql). **Image hosting**: no infra hosting decision exists yet (that's due end of M3 per
`docs/ROADMAP.md`), so rather than standing up our own storage, `image_urls` points directly at
jsdelivr's GitHub CDN (`cdn.jsdelivr.net/gh/<repo>@<sha>/...`) - unlike `raw.githubusercontent.com`,
jsdelivr is explicitly meant for hotlinking repo content and serves real cache headers.

Second roadmap item done: exercise library + filters. `GET /exercise` (`apps/api/src/exercise/`)
filters `app.exercise` by muscle (checked against both primary and secondary via jsonb `@>`
containment) and/or equipment, validated against the `exerciseMuscleSchema`/`exerciseEquipmentSchema`
enums in `packages/shared` (fixed value sets from the free-exercise-db import, not open free text);
always excludes `is_custom` rows since no custom-exercise creation flow exists yet to scope them by
account. No auth guard - like `/food/search`, this is shared reference data. `apps/mobile`'s
`ExerciseLibraryScreen` (two `ChipSelect` filters, reusing the same component as onboarding) ->
`ExerciseDetailScreen` (instructions + image, passed via route params - no second network round
trip for data already in hand) is wired to a new "Exercises" button on `HomeScreen`. Verified via
curl against the real `indb` database (unfiltered count, muscle-only, equipment-only, combined,
and a 400 on an invalid muscle value) plus unit tests in both `apps/api` and `apps/mobile`.

Third roadmap item done: workout session logger, fully offline. `app.workout_session`/
`app.workout_set` now have adapters in `sync.service.ts`'s registry (same shape as `food_log`'s -
no macro-style enrichment needed, so these are simpler). `apps/mobile/src/lib/workout-repo.ts` is
the outbox for both tables, following `custom-food-repo.ts`'s dirty-flag/`applyRemote*` pattern -
`workout_set.exercise_name` is a **local-only** display snapshot (like `food_log`'s macro columns),
never sent to or expected from the server. `sync-engine.ts` pushes sessions before their sets in
the same batch (parent-before-child, same ordering `custom_food`/`custom_food_ingredient` already
rely on, since a push applies rows in array order within one transaction and a new session's sets
FK to it). `apps/mobile`'s `WorkoutSessionScreen` (start/resume today's session, "Add exercise" ->
`ExerciseLibraryScreen` in a new `mode: "pickExercise"` that hands the pick back via route params -
the same pattern `CreateCustomFoodScreen`/`FoodSearchScreen` use for picking an ingredient -> inline
reps/weight/RPE/warm-up form -> "End workout") is wired to a new "Workout" button on `HomeScreen`.
Verified against the real `indb` database: curl push/pull/stale-reject/soft-delete through `/sync`
for both tables (including a real FK to an imported exercise id), psql spot-check of the landed
rows, plus unit tests in both `apps/api` (`sync.service.test.ts`) and `apps/mobile`
(`workout-repo.test.ts`, `sync-engine.test.ts`).

Fourth roadmap item done: PRs (Epley 1RM, rep PRs). `packages/shared/src/workout-prs.ts`
(`summarizeExercisePrs`/`detectNewPrs`, pure and unit-tested per the formula rule below) reuses
`targets.ts`'s existing `estimateOneRepMax` (already there, already tested, from M1/M2 scaffolding
- found before writing a second Epley implementation) rather than duplicating it. Computed
**entirely client-side** from the local SQLite mirror - no new API endpoint, since the account's
full `workout_set` history is already there via `/sync`, and PR aggregation is a cheap pure
function over it; `workout_set_pr_idx` remains there for when a server-side query needs it (e.g. a
future stats page). "Rep PR" is tracked per distinct weight (`bestRepsByWeightKg`), not as a single
number, since beating your rep count at an already-attempted weight is itself a PR even without
lifting heavier - and a weight never attempted before registers as a PR too (first attempt = new
best, not a non-event). `apps/mobile`'s `WorkoutSessionScreen` shows the current best weight/Est.
1RM for the picked exercise above the set-entry form (fetched via the new `listSetsForExercise`
in `workout-repo.ts`, refetched on every exercise pick so it reflects sets just logged moments
earlier), and a "New PR -..." banner naming which record(s) a just-saved set broke. Verified via
12 unit tests in `packages/shared` (including isolated cases like "more reps at a lighter weight
beats a max-effort single's Epley estimate without being a weight PR") plus `workout-repo.test.ts`
for the new lifetime-history query; no server-side change, so no curl/psql step was needed this
time.

Fifth/sixth roadmap items done: the 4 built-in programs (PPL, upper/lower, full-body beginner,
home/no-equipment) and the "follow program" flow - **all of M3 is now done.** `app.program`/
`app.program_day`/`app.program_exercise` (schema already existed from `0002_app_schema.sql`) are
seeded by `db/seed-programs.ts` (`pnpm seed:programs`, run after `pnpm import:exercises` since
every `exercise_id` has a hard FK to `app.exercise`) - every exercise in every program was looked
up against the real imported data via psql, not guessed. Re-runnable the same way as the other
seed/import scripts: each row's id is a deterministic hash of a readable slug (these tables have
no natural external key the way `app.exercise` does), so a re-run always UPSERTs the same rows.
`GET /program` (`apps/api/src/program/`) returns built-in programs with their days/exercises
nested (joined against `app.exercise` for display names, 3 queries total - not N+1), unauthenticated
like `/exercise`.

**"Follow a program" is local-only state** - there's no server-side "account follows program X"
table (checked `ARCHITECTURE.md` §2, nothing there). `apps/mobile`'s new `ProgramsScreen` (reachable
from onboarding, which now routes there instead of straight to `Home` - PRD §5.4 "programs
selectable in onboarding" - and from a `Home` button) caches the picked program's full JSON in
`kv` under `FOLLOWED_PROGRAM_KEY`/`FOLLOWED_PROGRAM_ID_KEY` (moved into `kv-store.ts` itself since,
unlike e.g. `HomeScreen`'s screen-local `CACHED_GOAL_KEY`, this key crosses a screen boundary -
`ProgramsScreen` writes it, `WorkoutSessionScreen` reads it). `packages/shared/src/programs.ts`'s
`nextProgramDayId` (pure, unit-tested) cycles through a followed program's days using
`workout-repo.ts`'s new `getLastUsedProgramDayId` (the account's most recent session among that
program's own day ids) - `WorkoutSessionScreen`'s "Start workout" sets the new session's
`programDayId` from this before anything is logged. When a session has a `programDayId`, the
screen shows "Today's plan" (that day's exercises with target sets/reps) as tappable rows that
jump straight into the existing set-entry form (skipping the `ExerciseLibrary` picker) - `"Add
exercise"` still works alongside it for anything off-plan. Verified against the real `indb`
database: curl `GET /program` (4 programs, correct nested days/exercises), a full push/pull of a
`workout_session` with a real `program_day_id` through `/sync` (FK holds), psql spot-check, plus
unit tests in `apps/api`, `apps/mobile`, and `packages/shared`.

**M4 (AI meal logging + barcode) is complete.** First roadmap item: AI gateway interface +
chosen provider wired. AI provider decided: **OpenAI** (PRD §9's tracked open question, now
closed) - `gpt-4o-mini` for parsing, `gpt-4o` reserved for the M5 coach. `apps/api/src/ai/`:
`AiProvider` (`ai-provider.interface.ts`) deliberately has only `parseMealText` for now -
ARCHITECTURE.md §5's full interface sketch (`parseMealImage`/`chat`/`generatePlan`) is the
eventual shape across M4/M5, not something to stub ahead of the features that need it.
`OpenAiProvider` calls `chat.completions.parse` with a Zod response format
(`openai/helpers/zod`'s `zodResponseFormat`) so the model's output is validated structured JSON,
not freeform text to parse by hand. Like `DatabaseService`, `OpenAiProvider` itself has no
dedicated unit test (it's a thin wrapper around a real paid external API) - `AiService`'s test
mocks the `AI_PROVIDER` DI token the same way other services mock `DatabaseService`.
`POST /ai/meal/parse-text` is auth-gated (`JwtAuthGuard`) even though nothing is account-scoped
yet, unlike `/food/search`/`/exercise` - every call costs real money, so it can't be an open
endpoint. Verified with real OpenAI calls (not mocked): "2 roti aur dal" → `roti x2 piece`,
`dal x1 bowl`; "3 idlis with sambar and a cup of filter coffee" and "paneer bhurji and chapati"
(implicit quantity) both parsed correctly; missing auth → 401; empty text → 400.

Second roadmap item done: text-based meal parse → draft → confirm → log (Hinglish tested).
`apps/api/src/ai/ai-meal-draft.service.ts`'s `resolveDraft` calls `AiService.parseMealText` then
`FoodService.search` (existing fuzzy `search_foods()`) for each raw item, top-1 match. Per
ARCHITECTURE.md §5's own wording ("resolved to a food_id... **or** explicitly flagged
`is_estimate`"), a match is never flagged `is_estimate` - only an unresolved item is (`foodSource`/
`foodRef` null). `POST /ai/meal/parse` returns this draft; nothing is written to `food_log` from
here - `apps/mobile`'s new `LogMealFromTextScreen` shows it for editing (per-item quantity/unit via
the same `servingMeasures`/live-preview logic `LogFoodScreen` already has, fetched via the
existing `getFoodDetail`) and logs each resolved item through the existing local food-log outbox
with `source: "ai_text"` - no new log-writing code, reusing `food-log-repo.ts`'s `insert` +
`syncNow` exactly as manual logging does. A real smoke test surfaced a genuinely wrong match
("filter coffee" → "Coffee drops" from `search_foods()`'s fuzzy ranking) - that's why "Find a
different match" exists: a new `pickMealItem` mode on `FoodSearchScreen` (alongside the existing
`pickIngredient`) hands the replacement back to `LogMealFromTextScreen` via route params, the same
cross-screen pattern `CreateCustomFoodScreen` already uses. Verified against real OpenAI + the
real `indb` database: parse → fetch matched food detail → `POST /food-log` with
`source: "ai_text"`, psql-confirmed row, plus unit tests in `apps/api` and `apps/mobile`.

Third roadmap item done: photo-based meal parse (single photo, confirm screen). `AiProvider`
gained `parseMealImage` (ARCHITECTURE.md §5's full sketch now one method closer to real);
`OpenAiProvider` sends the image as a base64 data URI in a vision-capable chat completion, same
`gpt-4o-mini` + Zod structured output as text parsing. `AiMealDraftService`'s per-item
search-then-match loop is now shared (`resolveItems`) between `resolveDraft` (text) and the new
`resolveDraftFromImage` - the only difference is `resolveDraftFromImage` **always** flags
`is_estimate`, even for a matched item: a photo gives a visual portion guess, never a number the
user actually stated, so the quantity itself is always approximate regardless of whether the food
matched (text parsing's match-based rule is unchanged). `POST /ai/meal/parse-photo` takes a
multipart upload (`@nestjs/platform-express`'s `FileInterceptor`, explicit `multer.memoryStorage()`
so `file.buffer` is actually populated - the default is disk storage) capped at 8MB.
`apps/mobile`'s `LogMealFromTextScreen` (renamed in spirit, not in route, to cover both input
modes - see its docstring) gained "Take a photo"/"Choose from gallery" buttons via
`expo-image-picker`, sharing every bit of the existing draft-editing/confirm UI and logic with the
text path; a `logSource` state tracks which path populated the draft so confirm logs
`source: "ai_text"` or `"ai_photo"` correctly. Verified against real OpenAI + the real `indb`
database: a real Wikimedia Commons meal photo (dal-roti) correctly parsed to a matched item
(`isEstimate: true` as expected), plus missing-auth/missing-file/non-image-file error paths, plus
unit tests in `apps/api` and `apps/mobile`.

Fourth roadmap item done: barcode scan → Open Food Facts lookup → `app.packaged_food`
(ODbL, kept out of the CC BY/CC0 `indb` tables per `ARCHITECTURE.md` §2/PRD §6 - schema already
existed from M1). `apps/api/src/packaged-food/`'s `PackagedFoodService.lookupByBarcode` checks
our own cache (keyed by barcode) first; on a miss it calls the real Open Food Facts v2 API, maps
`nutriments` into `indb`-style nutrient codes (`energy_kcal`/`protein_g`/`fat_g`/`carb_g`/
`fibre_g`), and upserts - genuinely not-found returns null, which the client turns into PRD §5.5's
"not found, add it" flow (reusing the existing `CreateCustomFoodScreen`, not a new "submit to
packaged_food" UI - that would need moderation tooling `review_status`/`pending` imply but nothing
in the M4 roadmap bullet asks for). `GET /packaged-food/:barcode` is unauthenticated like
`/food/search`/`/exercise`: unlike the AI endpoints, an OFF lookup costs nothing per call.
`FoodLogService.enrichWithMacros` gained a `food_source === "packaged"` branch (quantity always
grams, same v1 simplification as custom foods) - threaded through both call sites
(`FoodLogService.listByDate` and `SyncService.pull`), so a packaged-food entry's macros show up
correctly whether read directly or synced. `apps/mobile`'s new `BarcodeScanScreen`
(`expo-camera`'s `CameraView`, debounced so a held barcode doesn't retrigger) hands the scanned
code to `LogPackagedFoodScreen` (mirrors `LogFoodScreen`'s quantity/meal-type/preview UI, grams-only).
Verified against the real Open Food Facts API + the real `indb` database: a real barcode found via
OFF's own search API (not guessed), cache-miss-then-hit, a not-found barcode, and a full
push/pull through `/sync` with correct macro enrichment both ways, plus unit tests in `apps/api`
and `apps/mobile` (`PackagedFoodService` itself is tested directly, unlike `OpenAiProvider` - this
is hand-written business logic, not a thin trusted-SDK wrapper).

Fifth roadmap item done: AI usage ledger + daily quota - **all of M4 is now done.**
`apps/api/src/ai/ai-usage.service.ts`'s `AiUsageService` is the home for both halves
(`AiService`'s own docstring anticipated this exact file before it existed, back when M4's first
item was built). `checkQuota` runs in `AiService` **before** the provider is ever called, so a
blocked request costs nothing real; `record` runs inside `OpenAiProvider` **after** a successful
response, since that's the only layer with the real `completion.usage` token counts - cost is
estimated from `gpt-4o-mini`'s published per-token pricing (a documented, tunable approximation,
not real billing data). The daily cap (`$0.10`/account) is a runaway/abuse safety guard, not a
tight match to PRD §8's "AI cost per MAU ≤ ₹15" - that figure is a to-be-validated *monthly
average across all monthly active users*, not a per-account daily ceiling, so equating the two
would be a category error; the actual threshold is a tunable constant, not hardcoded into the
enforcement logic. `AiProvider`'s interface gained `accountId` on both methods - restoring the
`ctx: UserContext` parameter ARCHITECTURE.md §5's original sketch always had, dropped earlier
only because nothing needed it yet. Verified against the real OpenAI API + the real `indb`
database: a real call recorded a real token count and cost in `app.ai_usage` (psql-confirmed),
then manually pushing that account's ledger over the threshold produced a real `403` on the next
call while a different account's calls kept succeeding (quota is per-account, not global), plus
unit tests in `apps/api` (including `estimateCostUsd`'s pricing math directly, the one piece of
new hand-written arithmetic worth pinning down on its own).

**M5 (AI coach, Health Connect, reminders) is in progress.** First roadmap item done: coach chat
grounded in the user's targets/logs, with deterministic, server-enforced safety guardrails.
`packages/shared/src/coach-safety.ts` holds the pure, directly-unit-tested guardrail logic PRD
§5.5 requires (`computeCalorieFloor`/`isCalorieTargetSafe` - the higher of "never below BMR" and
"never more than 25% below TDEE"; `detectEdSignal` - curated regex patterns plus a <800kcal/day
numeric check, deliberately erring toward false positives since that's the safe failure direction;
`mentionsMedicalCondition`; `MEDICAL_DISCLAIMER`/`ED_SIGNAL_RESPONSE`/`describeCalorieFloorRefusal`)
- these exist so the ROADMAP's "refuses 5 scripted unsafe prompts" exit criterion is pinned down by
real adversarial-prompt unit tests (`coach-safety.test.ts`), not left to hoping the model follows
its system prompt. `AiProvider` gained a `chat(accountId, messages: ChatMessage[])` method (model
`gpt-4o`, per PRD §9 - the cheaper `gpt-4o-mini` stays reserved for meal parsing); this required
turning `openai-provider.ts`'s `estimateCostUsd` from one hardcoded pricing rate into a per-model
lookup table, since `gpt-4o`'s real per-token cost is materially higher. `apps/api/src/coach/`'s
`CoachService` is where the guardrails actually get enforced server-side: an eating-disorder
signal short-circuits before the model is ever called (costs nothing, returns `ED_SIGNAL_RESPONSE`
directly); otherwise the system prompt is grounded in the account's real targets (`ProfileService`
- weight comes from `getLatestWeightKg`, a new method, since weight lives in `app.body_metric`, not
`app.profile`) and today's logged macros (`FoodLogService.listByDate`), and the model's *own reply*
is scanned afterward for a below-floor calorie suggestion (replaced wholesale with
`describeCalorieFloorRefusal` if found) and for a missing medical disclaimer when the user
mentioned a medical condition (appended if absent) - defense-in-depth against the model ignoring
an instruction, not reliance on it following one. `POST /coach/message` / `GET /coach/messages`
(`JwtAuthGuard`-protected) persist every turn to the pre-existing `app.chat_message` table; no new
migration was needed since M1 already created both `app.chat_message` and `app.ai_usage` with
`'coach_chat'` as a valid `feature` value. Verified end-to-end against the real OpenAI API + the
real local `indb` database: a pre-onboarding question correctly declined to give numeric advice,
a post-onboarding question correctly cited the account's real target macros, all 5 scripted unsafe
prompts handled correctly (3 ED-signal short-circuits that never reached the model, one extreme-
deficit request where the model itself respected the injected floor, one medical-condition
question that got the disclaimer appended), and `GET /coach/messages` returned the full
conversation in correct chronological order - plus unit tests in `packages/shared` (19 adversarial-
prompt/floor/disclaimer cases) and `apps/api` (`CoachService`'s guardrail-enforcement paths with a
mocked `AiService`/`ProfileService`/`FoodLogService`/`DatabaseService`).

Still to do for M5: Health Connect read (steps/exercise/weight) + opt-in write; meal/workout
reminders + logging streak. Mobile UI for coach chat (a `CoachChatScreen` with a visible medical-
disclaimer banner, wired into `RootNavigator`/`HomeScreen`) is also still pending - this increment
was server-only, following the same build-the-API-first-then-the-screen cadence used for M3/M4's
other features.

**Known issue, resolved**: Vitest's default esbuild transform doesn't emit TypeScript's
`emitDecoratorMetadata`, which NestJS constructor injection needs - `apps/api/vitest.config.ts`
now uses `unplugin-swc` with `decoratorMetadata: true` instead. Verified with `AuthService`'s test
(real constructor injection of `DatabaseService`/`JwtService`). Every `apps/api` service test
since (`ProfileService`, `FoodService`, `FoodLogService`) mocks `DatabaseService` the same way -
follow that pattern, no special config needed per-test.

**Known trap: cross-package imports between `apps/api` and `packages/shared`.** `apps/api` uses
`"moduleResolution": "NodeNext"` (requires `.js` extensions on relative imports, checked at
typecheck time) but `packages/shared` is consumed as raw `.ts` source with no build step for
`"main"` (needed so Metro/Vite/Node's native TS runtime can resolve it - extensionless imports
only, confirmed by an actual `ERR_MODULE_NOT_FOUND` when this was gotten wrong). The fix already in
place: `packages/shared/src/index.ts` (the `"main"` entry, extensionless/`.ts`-extension imports,
runtime-only) is a **separate file** from `src/index.types.ts` (the `"types"` entry, `.js`-extension
imports, declaration-only build via `tsconfig.build.json` -> `dist/`, which `apps/api`'s
`skipLibCheck` then treats as an opaque library). **Adding a new export to `packages/shared`?**
Add it to the relevant file under `src/` as normal - both `index.ts` and `index.types.ts` already
re-export everything via `export *`, so no changes needed there unless you add a new top-level
file. Do not collapse these two files back into one; do not add `.js` extensions to `index.ts` or
remove them from `index.types.ts`. `turbo.json`'s `typecheck` task depends on `^build` so
`packages/shared`'s declarations rebuild automatically before any dependent package typechecks.

## Repo map

```
apps/
  api/                 NestJS API (TypeScript, ESM). src/<feature>/*.controller.ts,
                       *.service.ts, *.module.ts. dev script uses tsc-watch, NOT tsx (see below).
                       Features so far: health, auth (guest JWT), food (search + detail),
                       food-log (manual meal log CRUD), profile (onboarding + targets), sync
                       (push/pull), exercise (library + muscle/equipment filters), program
                       (built-in program library, nested days/exercises), ai (OpenAI-backed
                       text/photo meal parsing via a provider-agnostic gateway interface, usage
                       ledger + daily quota), packaged-food (barcode scan via Open Food Facts),
                       coach (AI coach chat grounded in targets/logs, with server-enforced
                       ED-signal/calorie-floor/medical-disclaimer safety guardrails).
  mobile/              Expo app (TypeScript, SDK 58), React Navigation stack. src/screens/,
                       src/lib/ (api.ts client, analytics.ts, auth-storage.ts, env.ts, db.ts),
                       src/components/ (ChipSelect, a generic enum picker reused across screens).
packages/
  shared/              Pure TS: nutrition/target formulas (targets.ts) and Zod schemas
                       (schemas.ts) shared by apps/api and apps/mobile. No I/O, no framework deps.
                       Two entry points, not one - see "Known trap" above before touching index.ts
                       or index.types.ts.
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
  new features during development, but are not a substitute for a committed automated test - every
  `apps/api` feature so far (auth, profile, food, food-log) has both: a mocked-`DatabaseService`
  unit test *and* a manual curl pass against the real `indb` database before being called done.

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
