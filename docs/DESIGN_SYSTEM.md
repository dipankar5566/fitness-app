# Design System — `apps/mobile`

Living reference for the tokens and component primitives introduced in the Stage 2 redesign pass.
Source of truth is the code - `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx`,
`src/components/ui.tsx`, `src/components/Charts.tsx`, `src/components/ChipSelect.tsx` - this file
explains *why* each exists, not a duplicate spec to keep in sync by hand.

## Identity

Leaf green (`primary`), not HealthifyMe's teal - see `healthifyme-re/UI_UX.md` for the teardown
this was informed by (patterns only, never copied code/assets/strings, per `CLAUDE.md`). An M3-style
tonal structure (primary/primaryTonal/primaryDark, surface/surfaceRaised/surfaceAlt) replaces a flat
single-tone palette so cards and raised surfaces read as elevated without relying only on a border.

## Tokens (`theme/tokens.ts`)

- **Colors** - `lightColors`/`darkColors`, same `ThemeColors` interface (plain `string` fields, not
  `as const` literals - see the type's own docstring for why that matters for the ternary that
  picks between them). Never import these two directly outside `theme/`; always go through
  `useTheme()`.
- **Macro colors** - protein/carb/fat/fibre each get a genuinely distinct hue (not shades of one
  family) so they stay distinguishable without relying on their text labels. `accent` (used for
  gamification: the streak flame, the Lv chip, badges) is a different hue family from `carb` -
  before this pass both were the same amber (`docs/UI_UX_AUDIT.md` finding H2), so a streak chip
  and a carb bar read as the same signal at a glance. Now: `carb` is goldenrod, `accent` is ember
  orange.
- **space / radius** - unchanged 8px-ish scale from the original pass.
- **elevation** - Android Material `elevation` integers (0/1/3/6/8), for the few surfaces that
  should visibly float (bottom sheets, dialogs) - most cards stay flat (stroke only), keeping the
  existing restrained look rather than adding shadows everywhere.
- **sizes** - `touchTarget: 48` (Android's 48dp minimum, confirmed via the ui-ux-pro-max
  `--domain ux` "Touch Target Size" guideline), `buttonHeight: 52`, `touchGap: 8`, icon sizes.
  Every new interactive primitive sizes itself from these instead of a one-off magic number -
  `docs/UI_UX_AUDIT.md` C2 found several existing controls well under 48dp.
- **motion** - `fast/base/slow` (120/200/300ms) durations for Stage 9's animation pass; not yet
  wired into every transition, so a screen without a wired-up animation currently has none (no
  regression - there were no animations before this pass either).
- **textVariants** - added `display` (36px, hero numeric metrics like Today's calorie ring and
  Me's target kcal - previously these reused `h1` at 24px, undersized for a screen's single most
  important number) and `label` (13px semibold, form/field labels - previously `TextField`/
  `ChipSelect` labels reused `captionMedium`, the same weight as their own helper/error text).
  `micro` (10px) stays, reserved for genuine micro-captions; audit finding C2 flagged real content
  using it below a readable floor - fixed opportunistically wherever a screen was already being
  touched, not yet swept across every remaining screen (tracked, not silently dropped).

## Component library (`components/ui.tsx`, `Charts.tsx`, `ChipSelect.tsx`)

Every primitive now reads colors via `useTheme()`/`makeStyles()` (see docs/THEME_SYSTEM.md) instead
of a static import, so every one of them is theme-reactive for free.

- **`Screen` / `Card` / `AppText` / `Button` / `TextField` / `ListRow` / `SectionHeader` /
  `EmptyState` / `Badge`** - same API as before, now theme-reactive. `AppText`'s `color` prop is
  now optional (defaults to the theme's own text color) rather than requiring every call site to
  import `colors.text` explicitly.
- **`IconButton`** - `label` is now a *required* prop, not optional (`docs/UI_UX_AUDIT.md` C2: only
  one `accessibilityLabel` existed in the whole app before this). A missing label is now a
  TypeScript error, not something easy to forget at a new call site. Hit area is a real 48dp box,
  not a 22px glyph with 4px padding.
- **`Stepper`** (new) - large +/- numeric control for quantities/reps/weight, replacing a bare
  `TextField` (`docs/UI_UX_AUDIT.md` H3/M5). Still shows the live numeric value in the center, just
  without requiring the keyboard for a simple +1/-1 change.
- **`CheckboxRow`** (new) - a real `accessibilityRole="checkbox"` control, replacing
  `WorkoutSessionScreen`'s literal `"☐ Warm-up set"` text glyph.
- **`ProgressRing`** - gained an `accessibilityLabel`/`accessibilityValue` (role `progressbar`) so a
  screen reader can describe the ring's percentage instead of silently skipping an SVG.
- **`MacroBar`** - same, `accessibilityValue` reporting grams eaten vs. target.
- **`LineSpark`** - gained a `unit` prop, a light gridline, an end-point dot, and min/max axis
  labels underneath - previously this chart (Today's weight trend) had zero axis context
  (`docs/UI_UX_AUDIT.md` H5/L2: "never present an estimate as a measurement without saying what it
  is", and more basically, a line with no scale is just a shape).
- **`ChipSelect`** - same visual API, now `accessibilityRole="radiogroup"`/`"radio"` with per-chip
  labels, and each chip is a real 48dp touch target (was ~40dp).

## What changed vs. what's queued

This pass fully migrated: `theme/`, `components/ui.tsx`, `components/Charts.tsx`,
`components/ChipSelect.tsx`, `components/FastingCard.tsx`, `navigation/MainTabs.tsx`,
`navigation/RootNavigator.tsx`, `App.tsx`, `screens/TabScreens.tsx` (Log/Workout/Me tabs, plus the
new theme picker and Me's regrouping), and `screens/HomeScreen.tsx` (Today - promoted ahead of its
originally-planned stage after a live emulator check; see `docs/THEME_SYSTEM.md` for why). Every
other screen still imports the static `colors` export (an alias for `lightColors`) and therefore
**already picks up the new light-palette fixes** (the accent/carb color separation, the
touch-target sizes wherever it uses the shared primitives) but renders a **mixed, not fully
light** look in dark mode until it's migrated - see `docs/THEME_SYSTEM.md` for the exact mechanism.
This is deliberate, not an oversight: rather than one mechanical pass over every file and a second
pass to redesign each screen, each remaining screen gets migrated and redesigned together, in the
same commit, as its own stage (Nutrition, Workout, Progress, Profile/secondary) reaches it - see
the plan's stage list. `docs/THEME_SYSTEM.md` tracks exactly which screens are done.

## Deliberately not done here

No new npm dependency was added. One was considered (`expo-clipboard`, for a "copy account ID"
row) and dropped in favor of React Native's own `<Text selectable>` (Android's native
text-selection toolbar already offers Copy on long-press) - no dependency needed for that one row.
