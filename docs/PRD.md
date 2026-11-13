# <AppName> — Product Requirements (v0.1, beta scope)

> Working name `<AppName>` until branding is decided. Built from scratch: the HealthifyMe teardown
> (`../healthifyme-re/`) informs ideas and architecture only — no HealthifyMe code, data, assets or branding.

## 1. Vision
The free, no-nonsense nutrition + training app for Indian gym-goers: log an Indian meal in seconds
(type, speak or snap "2 roti, dal, paneer bhurji"), hit your protein, and train with a real workout logger —
without upsell walls.

## 2. Users
**Primary persona — "Rahul, 24, gym 4×/week"**: wants to bulk/cut/recomp, tracks protein, eats home-cooked
Indian food + packaged whey/oats, uses Hevy-style logging, finds HealthifyMe too sales-heavy and MyFitnessPal
weak on Indian food.
**Secondary — "Priya, 29, home workouts"**: vegetarian (sometimes Jain at home), trains without equipment,
wants simple macro targets and quick logging.

Age: **18+ only in beta** (DPDP: under-18 needs verifiable parental consent — deferred).

## 3. Positioning
| | <AppName> | HealthifyMe | Fittr | MyFitnessPal / Cronometer | Hevy / Strong |
|---|---|---|---|---|---|
| Indian food depth | ✅ INDB + regional names | ✅ | ◐ | ❌ weak | ❌ |
| Free core (log + targets + workouts) | ✅ no paywall walls | ◐ heavy upsell | ◐ | ◐ | ✅ |
| AI logging (photo/text/voice, Indian) | ✅ core | ✅ Snap/Ria | ❌ | ◐ | ❌ |
| Serious workout logging | ✅ | ◐ | ◐ | ❌ | ✅ |
| Nutrition + training in one | ✅ | ◐ | ✅ | ❌ | ❌ |

**Free-core principle**: food logging, targets, barcode, workout logging, programs and progress are free
forever. Premium (later, undecided) may only add *extra* value (higher AI quotas, advanced plans) — never
gate the basics.

## 4. Goals / non-goals (beta)
Goals: fastest Indian-meal logging; accurate protein/macro targets for training goals; complete workout logger;
AI that is useful *and* cheap; works offline; privacy-respectful.
Non-goals (beta): iOS, non-English UI, human coaching marketplace, payments/paywall, CGM/smart-scale hardware,
under-18 users, web app.

## 5. Features & acceptance criteria
Priority: all four pillars are beta must-haves, each in a **lean beta version**; "Later" items are post-beta.

### 5.1 Onboarding & targets
- Stories: as a user I enter age, sex, height, weight, activity, training days/week, goal (bulk/cut/recomp/
  maintain), diet type (veg/eggetarian/non-veg/vegan/Jain) and get daily kcal + protein/carbs/fat targets.
- Rules: BMR = Mifflin-St Jeor; TDEE = BMR × activity factor; goal adjustment cut −15–20 %, bulk +8–12 %,
  recomp/maintain 0 %; protein 1.6–2.2 g/kg (cut highest), fat ≥ 0.6 g/kg, carbs = remainder; **training-day
  carb cycling** (training day +10 % carbs, rest day −10 %, weekly kcal constant); fasting day / IF window mode.
- AC: targets computed offline in < 50 ms; user can override any target; changing goal recomputes; guest users
  get full targets without an account.

### 5.2 Food search & logging
- Search INDB recipes + USDA ingredients + packaged + custom foods in English, Hindi (Devanagari & romanised)
  and regional names; ranked by match + meal-time relevance + user history.
- Log with household servings (bowl, katori, roti, piece, scoop) or grams; quick-add kcal/macros; copy
  yesterday/meal; favourites & recents.
- Diet-type filter: Jain hides onion/garlic/root vegetables, vegan hides dairy/egg/meat; fasting mode shows
  vrat-friendly foods.
- **Barcode**: scan EAN → Open Food Facts India; unknown products → user submits label photo + values (review queue).
- **Supplements**: curated whey/creatine/gainer entries + barcode.
- **Restaurant/chain dishes**: curated common dishes; otherwise AI estimate, always labelled "estimate".
- **Custom foods & recipes**: build recipe from ingredients → per-serving nutrition computed.
- AC: search p95 < 300 ms online, works offline for INDB core + recents; logging a recent food ≤ 2 taps;
  every nutrient value shows its source (INDB / USDA / OFF / user / AI estimate).

### 5.3 AI meal logging (lean beta: text + photo; voice = Later)
- Text/Hinglish: "2 roti aur ek katori dal" → parsed items, matched to DB foods, portions, macros → user
  confirms/edits before saving.
- Photo: detect items + portion estimate → same confirm screen; low-confidence items flagged.
- AC: parsed items always map to DB food ids (no free-floating numbers unless marked estimate); user edit
  rate tracked; median latency < 6 s; per-user daily AI quota enforced; never saves without confirmation.

### 5.4 Workouts
- Exercise library from **free-exercise-db** (public domain, 800+ exercises with images), filter by muscle/
  equipment; custom exercises.
- Logger: sets × reps × weight (kg), RPE optional, rest timer, supersets; previous-session values shown.
- PRs (1RM est. Epley, rep PRs), progressive-overload suggestion (+2.5 kg / +1 rep rules).
- Programs: built-in PPL, upper/lower, full-body beginner, **home/no-equipment**; follow a program → today's session.
- AC: logging fully offline; a set logs in ≤ 2 taps; history & PRs correct across sync; programs selectable in onboarding.

### 5.5 AI coach & AI plans (lean beta)
- Coach chat answers diet/training questions using the user's targets, logs and workouts; can propose actions
  (e.g. "log this", "swap to high-protein snack") the user taps to apply.
- AI plans: generate a weekly workout plan (goal, experience, equipment, days) and a sample day meal plan
  meeting targets with Indian foods respecting diet type.
- Safety: no medical diagnosis; disclaimer; refuses extreme deficits (< BMR or > 25 % deficit), flags
  eating-disorder signals with resources; suggests a doctor for medical conditions.
- AC: answers cite the user data used; plans validate against targets (±5 %) before display; quota enforced.

### 5.6 Progress, reminders, social, integrations
- Progress: weight trend (7-day avg), measurements, progress photos (on-device by default), strength graphs.
- Reminders & streaks: meal/workout/water reminders, logging streak (forgiving: 1 freeze/week).
- Social (lean beta): share workout/PR card image; Later: friends, gym groups, feed.
- Health Connect: read steps, exercise sessions, weight; write workouts (opt-in per data type).

## 6. Data sources & licences
| Data | Licence | Notes |
|---|---|---|
| INDB (1,014 Indian recipes) | CC BY 4.0 | attribution in About screen |
| USDA FoodData Central | CC0 | 306 ingredient profiles; proxies flagged |
| Open Food Facts India | ODbL | kept in separate table; share-alike applies to that DB |
| free-exercise-db | Unlicense (public domain) | exercises + images |
| Curated / user data | ours | user submissions under ToS licence |
IFCT 2017 (NIN) only with written permission.

## 7. Privacy, compliance, policy
- DPDP Act 2023 + Rules 2025 (notified 14 Nov 2025; most obligations from 13 May 2027 — build compliant from day 1):
  itemised notice, purpose-specific opt-in consent (no pre-ticked boxes), consent withdrawal as easy as giving,
  consent records, data export & account deletion in-app, breach process, retention limits, 18+ gate.
- Health data minimisation; progress photos local unless user opts into backup; analytics without health values.
- Google Play: Health apps declaration, Health Connect permissions rationale, data-safety form, medical disclaimer.

## 8. Success metrics (beta)
D1 ≥ 50 %, D7 ≥ 30 %, D30 ≥ 15 % · median days logged/week ≥ 4 · AI-log accept-without-edit ≥ 60 % ·
workouts logged/active user/week ≥ 2 · AI cost per MAU ≤ ₹15 (target, to be validated) · crash-free ≥ 99.5 %.

## 9. Open questions (with decide-by)
| Question | Decide by |
|---|---|
| AI provider(s) & model per task | end of week 6 (before M4) |
| Hosting & India data residency | end of week 10 (before beta) |
| Revenue model | after beta data (~week 16) |
| App name & brand | before Play closed testing (week 11) |
| Under-18 support | post-beta |
