# UI/UX Audit — `apps/mobile`

**Date:** 2026-11-23. **Method:** full source read of `apps/mobile/src` (22 stack/tab screens,
`components/ui.tsx`, `components/Charts.tsx`, `theme/tokens.ts`, `navigation/`) plus a live pass
on the running Android emulator (`fitness_app_avd`, API 3011 + Metro 8081 already up), captured
with real ADB screenshots and `uiautomator` dumps — not simulated. Baseline screenshots are in
`docs/screenshots/before/`, named in the order captured; the number prefix is referenced below as
`before/NN_name.png`.

**Framework, confirmed (not assumed):** Expo SDK 58, React Native 0.88, TypeScript. React
Navigation (native-stack root + a bottom-tabs "Home" screen). **Not** Jetpack Compose and not
XML Android views — the earlier guidance in this prompt about inspecting for Compose/XML/Kotlin
doesn't apply; this is a cross-platform RN app built and shipped Android-only so far (`app.json`
has no iOS-specific entitlements in play yet, `ios.supportsTablet` is just the Expo default).
State management: plain React hooks + `useFocusEffect`, no Redux/Zustand. DI: none (direct
imports). Existing component library: `components/ui.tsx` (`Screen`, `Card`, `AppText`, `Button`,
`TextField`, `ListRow`, `SectionHeader`, `EmptyState`, `Badge`, `IconButton`) and
`components/Charts.tsx` (`ProgressRing`, `MacroBar`, `LineSpark`). Typography: Inter via
`@expo-google-fonts/inter`. Icons: `@expo/vector-icons` (MaterialCommunityIcons) — SVG vector
icons throughout, not emoji. Charts: hand-rolled `react-native-svg`, no chart library.
Notifications: `expo-notifications`. Permissions: Android Health Connect (steps/exercise/weight
read, exercise write) via `react-native-health-connect`, opt-in per data type. Health Connect
integration **already exists** — this task's own instructions to seek approval before introducing
Health Connect are moot here; it's pre-existing, and only its *presentation* is in scope. Tests:
Vitest, extensive (`*.test.ts` next to source, per `CLAUDE.md`).

**Theme system today: none.** There is exactly one palette (`theme/tokens.ts`'s `colors`), `app.json`
hardcodes `userInterfaceStyle: "light"`, and dark mode is structurally impossible until the
architecture changes (see Critical #1).

---

## Screen inventory

| # | Screen | File | Reachable from |
|---|--------|------|-----------------|
| 1 | GuestLoading | `GuestLoadingScreen.tsx` | App launch |
| 2 | Onboarding | `OnboardingScreen.tsx` | First launch / no profile |
| 3 | Today (tab) | `HomeScreen.tsx` | Bottom tab |
| 4 | Log (tab) | `TabScreens.tsx` (`LogTabScreen`) | Bottom tab |
| 5 | Workout (tab) | `TabScreens.tsx` (`WorkoutTabScreen`) | Bottom tab |
| 6 | Me (tab) | `TabScreens.tsx` (`MeTabScreen`) | Bottom tab |
| 7 | FoodSearch | `FoodSearchScreen.tsx` | Today/Log/Workout CTAs |
| 8 | LogFood | `LogFoodScreen.tsx` | FoodSearch row |
| 9 | MyFoods | `MyFoodsScreen.tsx` | Log/Me |
| 10 | CreateCustomFood | `CreateCustomFoodScreen.tsx` | MyFoods |
| 11 | IngredientQuantity | `IngredientQuantityScreen.tsx` | CreateCustomFood |
| 12 | ExerciseLibrary | `ExerciseLibraryScreen.tsx` | Workout tab / WorkoutSession "Add exercise" |
| 13 | ExerciseDetail | `ExerciseDetailScreen.tsx` | ExerciseLibrary row |
| 14 | WorkoutSession | `WorkoutSessionScreen.tsx` | Workout tab / Today workout card |
| 15 | Programs | `ProgramsScreen.tsx` | Onboarding / Workout tab / Me |
| 16 | LogMealFromText | `LogMealFromTextScreen.tsx` | Today/Log "AI / Photo" |
| 17 | BarcodeScan | `BarcodeScanScreen.tsx` | Today/Log "Scan" |
| 18 | LogPackagedFood | `LogPackagedFoodScreen.tsx` | BarcodeScan hit |
| 19 | CoachChat | `CoachChatScreen.tsx` | Today card / Me row |
| 20 | Reminders | `RemindersScreen.tsx` | Me row |
| 21 | HealthConnect | `HealthConnectScreen.tsx` | Me row |
| 22 | Achievements | `AchievementsScreen.tsx` | Today chip/banner / Me row |
| 23 | MealPlan | `MealPlanScreen.tsx` | Today/Log "Plan" |
| 24 | FastingCard (embedded component, not a screen) | `components/FastingCard.tsx` | Today |
| — | Home-screen widget | `src/widget/TodayWidget.tsx` | Android launcher, outside the app |

23 screens + 1 embedded card + 1 widget. Every route in `RootNavigator.tsx` is listed above; none
were skipped.

---

## Findings by severity

### Critical

**C1 — No dark mode is structurally possible.**
- **Screen:** every screen.
- **Problem:** `theme/tokens.ts` exports one static `colors` object, imported at module scope and
  baked into `StyleSheet.create({...})` calls in all 28 files that reference `colors`. `app.json`
  sets `"userInterfaceStyle": "light"`. There is no `ThemeProvider`, no `useColorScheme()` usage,
  and the `NavigationContainer`/status bar/Android navigation bar are all hardcoded light.
- **Why it matters:** the brief requires dark mode as a first-class, independently designed
  experience with system/light/dark selection and persistence. None of that is reachable without
  restructuring how every screen gets its colors.
- **Fix:** `ThemeProvider` + `useTheme()`/`makeStyles()` hook pattern, migrating every file off
  the static import.
- **Expected improvement:** dark mode becomes possible at all, plus a single place to tune both
  palettes together.

**C2 — Accessibility is essentially unimplemented.**
- **Screens:** all, worst on Today, WorkoutSession, Reminders.
- **Problem:** exactly one `accessibilityLabel` exists in the entire codebase (`HomeScreen.tsx`'s
  streak chip). `IconButton` (used for water +/-, modal close, badge-banner dismiss) has no
  `accessibilityLabel`/`accessibilityRole` and a ~30dp effective hit area (`padding: 4` around a
  22px glyph — see `components/ui.tsx`'s `iconButton` style), well under the 44–48dp minimum. The
  warm-up toggle in `WorkoutSessionScreen` (`before/12_workout_set_entry.png`) renders a literal
  `"☐ Warm-up set"` / `"☑ Warm-up set"` text glyph with no `accessibilityRole="checkbox"` or
  `accessibilityState`. Deleting a food log entry is long-press-only (`HomeScreen.handleDelete`,
  bound via `onLongPress`) with no visible affordance that it's possible. `textVariants.micro`
  (10px) is used for meaningful copy, not just captions (e.g. the "estimate" badge on log entries).
- **Why it matters:** TalkBack users can't identify or operate icon-only controls; anyone with
  reduced dexterity or an older device will mis-tap tiny hit targets; a 10px floor fails readable
  text guidance outright.
- **Fix:** a `Stepper`/`CheckboxRow`/`SwitchRow` component library with required labels and real
  roles, a 48dp minimum interactive size baked into the primitives, swipe-or-menu delete with a
  visible affordance, and a 12px floor for anything that isn't a true micro-caption.
- **Expected improvement:** the app becomes operable with TalkBack and meets WCAG 2.2 AA touch-
  target and text-size guidance.

### High

**H1 — Today's core task (the meal diary) is buried under seven stacked cards.**
- **Screen:** Today (`before/01_today.png`).
- **Problem:** scroll order is: title+chips → hero ring/macros → AI insight → activity card
  (conditional) → water → fasting → weight → 5-chip quick-action row → workout-status row →
  **then** the meal diary. A user opening the app to log lunch scrolls past six cards first.
- **Fix:** hero first, then a compact horizontal "habits" row (water/fasting/weight/steps as small
  tappable `StatTile`s, not full cards), then the meal diary immediately, with the coach insight
  reduced to one slim line.
- **Expected improvement:** the primary task is reachable without scrolling on a standard phone.

**H2 — Carb bar and the streak chip share one amber (`colors.accent`).**
- **Screen:** Today (`before/01_today.png` — the streak flame chip and the "Carbs" macro bar are
  visually the same hue).
- **Why it matters:** colour is being reused for two unrelated meanings; on a quick glance (or for
  a colour-vision-deficient user) they're indistinguishable, and macro colour-coding is undermined
  app-wide once dark mode needs its own careful macro palette anyway.
- **Fix:** give macros their own 4-colour family, distinct from any status/gamification colour.

**H3 — The workout logger is unusable one-handed mid-set.**
- **Screen:** WorkoutSession (`before/12_workout_set_entry.png`).
- **Problem:** reps/weight/RPE are three bare `TextField`s requiring the keyboard for every set;
  there's no prefill from the lifter's last set of that exercise, no rest timer, and no repeat-
  last-set shortcut. The red "End workout" button sits directly under the form with no
  confirmation — one mis-tap mid-session ends the whole workout.
- **Fix:** `Stepper`s prefilled from `listSetsForExercise`'s last entry, a "Repeat last set"
  button, a rest timer (auto-start, ±15s, skip, vibrate), and a confirm dialog on End workout.

**H4 — Exercise discovery requires scrolling past 24 filter chips before any result.**
- **Screen:** ExerciseLibrary in pick mode (`before/11_exercise_library_pick.png`).
- **Problem:** 13 muscle chips + 11 equipment chips (2 rows become 7) render above the exercise
  list with no search box — a user who knows the exercise name ("bench press") has no faster path
  than scrolling past all 24 chips or picking filters by trial.
- **Fix:** a search field above the filters, and/or a collapsed/sheet filter affordance.

**H5 — No progress or analytics view exists.**
- **Screen:** none — a gap. The only trend visualization anywhere is Today's unlabelled weight
  sparkline (no axis, range, or date, `HomeScreen.tsx`'s weight card).
- **Fix:** new Progress tab, built only from local data already synced (food_log, body_metric,
  workout_set) — no new API.

### Medium

**M1 — Log tab duplicates Today's quick actions with no added value.**
`TabScreens.tsx`'s `LogTabScreen` is a `Card` of `ListRow`s (Search/AI/Scan/Plan) that's a strict
subset of what Today's quick-action row already offers one tap away. It earns a whole tab slot for
zero unique functionality. (`before/02_log_tab.png`.)

**M2 — Me tab shows the raw account UUID.**
`before/14_me_tab.png` prints `21182eb1-3edb-4c89-b525-a58a2dab12cf` directly on screen, unlabelled,
for a guest account the user never typed and can't use for anything visible in the UI. It reads as
a debug leftover, not a feature. Move it behind a "Copy account ID" row, or drop it from this view
entirely.

**M3 — Settings and feature links are interleaved with no grouping.**
Me's "More" card mixes a gamification link (Achievements), content links (My foods, Programs), true
settings (Reminders, Health Connect), and a conversational feature (Coach) in one undifferentiated
list (`before/14_me_tab.png`). Group them (Profile & targets / Preferences / Activity / About).

**M4 — Onboarding date of birth is unvalidated free text.**
`OnboardingScreen.tsx`'s `dob` step is a plain `TextField` with `placeholder="YYYY-MM-DD"` — no
format enforcement, no picker, no inline validation feedback until submit.

**M5 — LogFood shows only per-100g data with a plain numeric quantity field.**
`before/07_log_food_detail.png`: "Per 100g: 341 kcal · 25.21g protein" and a bare `100` in a text
field. There's no serving-size framing (a plate/bowl/piece a user intuitively understands) and no
`+`/`-` stepper — every quantity change requires opening the keyboard and retyping.

**M6 — 20 uses of `Alert.alert` for in-flow input/confirmation instead of in-context UI.**
E.g. `HomeScreen.saveWeight`'s validation error, every delete confirmation. These block the whole
screen with a system dialog styled by the OS, not the app's design language, and can't carry the
app's own visual identity even once themed.

**M7 — No loading skeletons and no success feedback after logging.**
Logging a food, ending a workout, or saving a custom food all return to a screen with no
transition feedback beyond the data simply appearing — no confirmation toast/snackbar, no skeleton
placeholder while data loads (several screens show a bare `ActivityIndicator` centered on an
otherwise blank screen, e.g. `LogFoodScreen`).

**M8 — Programs list has a text-rendering overlap bug.**
`before/19_programs.png`: in the "Push / Pull / Legs" card, the second line of the Pull-day
exercise list ("Bent Over Barbell Row") visually overlaps/strikes through the line above it — a
real rendering defect (tight line-height against a dynamically-sized multi-line `Text`), not
image compression. Worth a specific regression check once that card is restyled.

**M9 — Reminders' toggles and barcode scanner don't match the brand.**
`before/16_reminders.png` uses the OS-default grey/white `Switch` (not themed green), and
`before/22_barcode_scan_live.png` is a bare full-bleed camera view with centered white text and no
viewfinder frame, corner markers, or torch control — functional, but generic.

### Low

**L1 — Achievements and Coach screens are already close to the target bar** (`before/15_achievements.png`,
`before/18_coach_chat.png`) — grouped cards, a visible progress bar, consistent icon language, a
real medical-disclaimer banner. These are the pattern to generalize outward, not screens that need
a rework from scratch.

**L2 — Health Connect settings show toggle state only, no source/freshness info.**
`before/17_health_connect.png` lists Steps/Exercise sessions/Weight/Sleep/Write as bare toggles
with no indication of *when* data was last read or from what source, contradicting the "distinguish
measured/manual/estimated" guidance for this exact kind of screen.

**L3 — `HomeScreen.todayDate()` uses the UTC calendar day, not local time.**
In IST (UTC+5:30), "today" on the Home screen flips over at 5:30 AM local time, not midnight. This
is business logic, not a visual issue — flagged for awareness, **not** scheduled for a fix in this
redesign per the "do not modify backend business logic" rule (this is client-side date math
feeding the local day boundary, functionally equivalent risk — left untouched, documented here and
in `docs/KNOWN_ISSUES.md` once that file exists).

---

## Screens that already meet the bar
Achievements, Coach chat, and Meal Plan (`before/20_meal_plan.png`) are the strongest existing
screens — grouped cards, a clear hierarchy, and (Coach) a genuinely considered safety-disclosure
pattern. The redesign generalizes their patterns rather than reinventing screens that already work.

## Not yet captured live
Onboarding and GuestLoading were not re-captured live in this pass (the test account is already
onboarded; forcing a fresh guest account would have required wiping the device's local data, which
risks losing the other screenshots' context foods/sessions). Both were read from source instead
(see Medium #4 for Onboarding's one real finding); they'll get a normal before/after pair once the
redesign reaches them, using a second guest account specifically for that.
