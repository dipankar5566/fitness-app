# UI/UX Redesign Changelog — `apps/mobile`

Nine-stage redesign pass (CLAUDE.md "`apps/mobile` UI/UX redesign" section has the running
summary; this file is the stage-by-stage history). Started from `docs/UI_UX_AUDIT.md`'s findings.
No API, sync, schema, or business-logic changes in any stage - every change is UI/presentation,
new read-only local queries, or a same-screen preview of an existing formula.

## Stage 1 — Audit
Baseline screenshots of every reachable screen (`docs/screenshots/before/`) + `docs/UI_UX_AUDIT.md`:
a 23-screen inventory and severity-ranked findings (critical: no dark mode, near-zero
accessibility; high: Today's information architecture, the workout logger's usability, no
progress view; medium: several smaller IA/clarity issues).

## Stage 2+3 — Theme architecture, dark mode, a11y foundations
`theme/tokens.ts` → `lightColors`/`darkColors` (one `ThemeColors` interface), `theme/ThemeProvider.tsx`
(`useTheme()`/`makeStyles()`, preference persisted in `kv`). `components/ui.tsx`/`Charts.tsx`
rewritten onto the hook (`IconButton.label` made required, fixing 5 call sites with no accessible
name), new `Stepper`/`CheckboxRow` primitives. `app.json` → `userInterfaceStyle: "automatic"`.
`HomeScreen` promoted into this stage early after a live pixel-sampled check showed an unmigrated
screen rendering a broken "mixed" light/dark patchwork, not a clean light fallback -
`docs/THEME_SYSTEM.md` documents why. `docs/DESIGN_SYSTEM.md`/`THEME_SYSTEM.md` written.

## Stage 4 — Nutrition
All 9 food-logging screens migrated: recents-first search, `Stepper`-based quantity entry,
macro-dot live previews, a 4-corner barcode viewfinder overlay. Two real bugs found and fixed:
unrounded float nutrient displays (`Math.round()`, display-only), and `MyFoodsScreen` deleting a
custom food with no confirmation (added an `Alert.alert` confirm, matching the pattern already
used elsewhere).

## Stage 5/6 — Workout
`WorkoutSessionScreen` rebuilt: rest timer (auto-starts on save, +/-15s, vibrates at zero),
"repeat last set", reps/weight `Stepper`s prefilled from that exercise's last set, sets grouped
per exercise, a confirm dialog before ending a session. `ExerciseLibraryScreen` gained a
client-side name filter. `ProgramsScreen` got a real text-overlap bug fix (a caption's line-height
was too tight for a 2-line exercise list).

## Stage 7 — New Progress tab
Fifth bottom tab, built entirely from the local SQLite mirror (no new API call, no schema
change): `packages/shared/src/progress.ts` (pure day-series/averaging aggregation, with
relationship tests - gaps are zero-filled and marked `hasData: false`, never interpolated or
dropped); two new read-only repo queries (`food-log-repo.dailyTotalsBetween`,
`workout-repo.listSessionDaysBetween`); a new `BarChart` (`components/Charts.tsx`, all-SVG/View,
no new chart dependency); `screens/ProgressScreen.tsx` (7d/30d toggle, calorie trend against
target, average logged protein, weight trend, workout-day consistency grid).

## Stage 8 — Onboarding redesign + remaining screens
`OnboardingScreen` rebuilt: a welcome step, structured DOB (three full-width `Stepper`s -
Day/Month/Year - replacing free-text `YYYY-MM-DD`), height/weight as unit-suffixed `Stepper`s, and
a closing targets-summary step previewing `packages/shared`'s existing `calculateMacroTargets` for
a training and a rest day (a preview only - `PUT /profile` still computes and stores the real
targets). A real bug was caught live: squeezing three `Stepper`s into one row shrank the +/-
buttons below the 48dp touch-target minimum and left no room for a 4-digit year, which visibly
clipped - fixed by stacking them full-width instead. The remaining five unmigrated screens
(`GuestLoadingScreen`, `CoachChatScreen`, `RemindersScreen`, `AchievementsScreen`,
`HealthConnectScreen`) were moved onto `useTheme()`/`makeStyles`, closing out the "mixed"
dark-mode risk for the whole app. `HealthConnectScreen` also gained a live per-type permission
check (`hasHcPermissions`, catching access revoked outside the app) and a "last read" timestamp
(`HC_LAST_READ_KEY`, written by `HomeScreen` after an actual read).

## Stage 9 — Contrast verification
`theme/contrast.ts` (pure WCAG relative-luminance/contrast-ratio math) + `theme/contrast.test.ts`,
checking both palettes against the AA thresholds `DESIGN_SYSTEM.md` had already claimed. The test
itself caught a real deficiency: light theme's `textTertiary` was 2.52:1 against the background -
below even the 3:1 large-text/graphics floor, despite being used for real information (axis
labels, "last read" times), not just decoration. Fixed by darkening the token. The plan's other
Stage 9 items (ring/bar fill animations with reduce-motion handling, skeleton loaders, a Snackbar
component, a live 200% font-scale device check) were not done this pass - see
`docs/KNOWN_ISSUES.md`.

## Stage 10 — This pass
Final QA documentation (`REDESIGN_CHANGELOG.md`, `QA_REPORT.md`, `KNOWN_ISSUES.md`) and a
CLAUDE.md status update. No code changes.
