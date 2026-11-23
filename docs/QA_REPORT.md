# QA Report — `apps/mobile` UI/UX redesign

What was actually verified for the 9-stage redesign (`docs/REDESIGN_CHANGELOG.md`), and what
wasn't. Per-stage automated verification (`pnpm lint && pnpm typecheck && pnpm test`) passed at
every stage - this report is about the parts that automated tests can't cover: real rendering,
real touch interaction, real dark-mode switching.

## Automated

`pnpm lint && pnpm typecheck && pnpm test` green at every stage, repo-wide, as of the last commit
(`05b3acc`): `packages/shared` 152 tests, `apps/mobile` 183 tests (183 includes the 14 new
`theme/contrast.test.ts` cases from Stage 9), `apps/api` 103 tests.

## Live device verification (real Android emulator, `fitness_app_avd`, standard density)

Tested, with real screenshots (`docs/screenshots/after/`):

- **Dark mode switching** - the in-app Appearance picker (System/Light/Dark) on Me, and the
  system `night yes/no` override - checked on: Today, Workout session + rest timer, Exercise
  library/search, Progress (7d and 30d), Coach chat, Me. No "mixed" patchwork found after
  Stage 2+3's HomeScreen fix (the one case that did happen, documented in
  `docs/THEME_SYSTEM.md`/the changelog).
- **Progress tab** - 7d and 30d toggle, both rendering real local data (one logged food entry,
  one logged workout day) correctly: calorie bar chart against target, protein average, empty
  weight-trend state, workout-consistency grid (including the 30-day 2-row wrap).
- **Full onboarding wizard, end to end, against the real API** - cleared the app
  (`pm clear`) for a genuinely fresh guest account, then: welcome → sex → DOB (3 Steppers) →
  height → weight → activity → diet → goal → targets summary (confirmed training-day carbs >
  rest-day carbs, matching the carb-cycling formula) → a real `PUT /profile` call → landed on
  Programs → skip → Today showing the just-saved targets. This is the pass that caught and fixed
  the DOB Stepper touch-target bug.
- **Workout session** - exercise search/filter, Stepper/CheckboxRow set entry, rest timer counting
  down with a "New PR" banner, sets grouped by exercise (Stage 5/6, carried forward from an
  earlier pass in this same redesign).
- **Health Connect, Reminders, Achievements, Coach** screens individually opened and visually
  checked in both light and dark after their Stage 8 migration - including the new "last read"
  line on Health Connect in its correct empty state ("Not read yet").

## Known test-environment flakiness (not a product bug)

Throughout this pass, `adb shell input tap` intermittently failed to register against the running
Metro/Fast-Refresh app for no visible reason (same coordinates that worked a moment earlier, or a
moment later, didn't register) - confirmed not a layout bug each time by re-dumping
`uiautomator` bounds and retrying, or by confirming an unrelated tap (e.g. dismissing a banner)
worked fine in between failed taps on the tab bar. Readers should not infer anything about touch
responsiveness in the real built app from these retries - the device/ADB occasionally dropped
events, the app did not.

## Not tested this pass

Per the original plan's Stage 10 scope, these were not exercised and nothing about them should be
assumed verified:

- **Compact (`720x1280`) and large (`1600x2560`) `wm size` overrides.** No screenshots at either
  density - only the AVD's native resolution was used throughout every stage.
- **200% system font-scale.** Not checked on any screen. Several screens use fixed-height rows
  (e.g. `ListRow`, `Stepper`'s `valueBox`) that have not been stress-tested against a doubled font
  size - the DOB-Stepper clipping bug found in Stage 8 at normal scale is exactly the class of bug
  a font-scale pass would also be likely to surface elsewhere.
- **A real physical device.** Every stage's live verification used the same emulator
  (`fitness_app_avd`) at its default resolution/density - no tablet, no other phone form factor,
  no real hardware.
- **Reduced-motion / ring-bar-fill animation behavior** - not built this pass (see
  `docs/KNOWN_ISSUES.md`), so nothing to verify yet.
- **Skeleton loaders, a Snackbar component** - not built this pass (see `docs/KNOWN_ISSUES.md`).
