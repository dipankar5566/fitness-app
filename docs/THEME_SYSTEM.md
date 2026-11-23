# Theme System — `apps/mobile`

## Architecture

- **`theme/tokens.ts`** exports `lightColors` and `darkColors`, both satisfying one `ThemeColors`
  interface (plain `string` fields - not `as const` literal types, which would make the two
  palettes structurally incompatible for the ternary that picks between them at runtime).
- **`theme/ThemeProvider.tsx`** is a React context: `{ colors, scheme, preference, setPreference }`.
  - `preference` is `"system" | "light" | "dark"`, persisted in the local `kv` table under
    `THEME_PREFERENCE_KEY` (`lib/kv-store.ts`), loaded once on mount and written on every change.
  - `scheme` is the *resolved* `"light" | "dark"` - when `preference === "system"`, it follows RN's
    `useColorScheme()` live (flips the moment the OS theme changes, no restart needed); otherwise
    it's pinned to the user's explicit choice.
  - `colors` is `scheme === "dark" ? darkColors : lightColors` - the only thing almost every
    screen actually needs.
  - `makeStyles((colors) => ({...}))` turns a factory into a `useStyles()` hook, memoized on
    `colors` so a style object is only rebuilt when the scheme actually changes, not on every
    render. This is the direct replacement for a module-level `StyleSheet.create({...colors...})`,
    which ran once at import time and could never react to anything.
- **`App.tsx`** wraps `RootNavigator` in `ThemeProvider`, mounted only after the local SQLite
  database is open (the same gate the app already applied before rendering anything) - so there's
  no flash of the wrong theme while a stored preference loads.
- **`app.json`**: `userInterfaceStyle: "automatic"` (was `"light"`) and a dark-matching
  `android.navigationBarColor` so the OS-drawn Android navigation bar doesn't clash with a dark
  screen. The in-app status bar follows the resolved scheme via a small `ThemedStatusBar`
  component rendered inside the provider (`App.tsx` itself can't call `useTheme()` above the
  provider that supplies it).
- **`navigation/RootNavigator.tsx`** passes a `theme` object to `NavigationContainer` built from
  React Navigation's own `DefaultTheme`/`DarkTheme` with our colors layered in (background, card,
  text, border, primary) - this covers chrome our own `screenOptions` doesn't reach (native modal
  backdrops, the default back-button tint). `MainTabs.tsx`'s bottom tab bar reads `useTheme()`
  directly for its own `tabBarStyle`/tint colors.

## Picking a theme

Me tab → Preferences → **Appearance** (`ChipSelect`, System/Light/Dark). Selecting an option calls
`setPreference`, which updates state immediately (no reload needed - every migrated screen
re-renders through `useTheme()`/`makeStyles()`) and persists to `kv` in the background.

## What "dark mode" covers right now

Fully theme-reactive: `theme/` itself, `components/ui.tsx` (every shared primitive: `Screen`,
`Card`, `AppText`, `Button`, `TextField`, `ListRow`, `SectionHeader`, `EmptyState`, `IconButton`,
`Badge`, `Stepper`, `CheckboxRow`), `components/Charts.tsx` (`ProgressRing`, `MacroBar`,
`LineSpark`), `components/ChipSelect.tsx`, `components/FastingCard.tsx`, the bottom tab bar, the
native-stack header/background, the Log/Workout/Me tab screens (`screens/TabScreens.tsx`), and
**Today** (`screens/HomeScreen.tsx`). Today was promoted out of its originally-planned later stage
after the live emulator check below surfaced a real bug: a not-yet-migrated screen isn't simply
"stays light" - its own explicit `colors.X` usages (passed as props, or in its own styles) stay
light, while every shared primitive it renders (`Card`, `AppText`'s default text colour,
`ProgressRing`'s default track colour, etc.) already reacts to the active theme, since those
components read `useTheme()` internally regardless of which screen uses them. The result on an
unmigrated screen in dark mode was a broken-looking patchwork (a light-green ring arc on a
near-black card), not a clean "always light" screen - worth fixing immediately rather than
shipping, since Today is the app's most-seen screen.

**Not yet migrated** (same caveat: a mixed look in dark mode until each one lands, not a clean
light screen): every flow screen (FoodSearch, LogFood, MyFoods, CreateCustomFood,
IngredientQuantity, ExerciseLibrary, ExerciseDetail, WorkoutSession, Programs, LogMealFromText,
BarcodeScan, LogPackagedFood, CoachChat, Reminders, HealthConnect, Achievements, MealPlan,
Onboarding, GuestLoading). Each gets migrated together with its own redesign stage (Nutrition,
Workout, Progress, Profile/secondary - see the implementation plan), not as a separate mechanical
pass, so the same file isn't touched twice for unrelated reasons - Today was the one deliberate
exception, for the reason above.

Because every migrated screen **and** the shared primitives already draw from the corrected light
palette (the carb/accent color fix, the 48dp touch targets), a not-yet-migrated screen still looks
right in light mode and still benefits from `ui.tsx`'s accessibility fixes wherever it uses those
primitives - it just won't flip to dark colors until its own stage lands.

## Verification done so far

- `pnpm lint && pnpm typecheck && pnpm test` green for `apps/mobile` and `packages/shared`
  (`apps/api`'s own typecheck script fails for an unrelated, pre-existing reason - the hoisted
  `node_modules/.bin` trap `CLAUDE.md` already documents - not touched by this change).
- Manual emulator check pending for this commit: toggle the Appearance picker on Me and confirm
  the tab bar, headers, and every migrated screen actually flip, plus `adb shell cmd uimode night
  yes|no` to confirm the System option follows the OS setting live.

## Known limitation, by design

A screen that hasn't been migrated yet will look identically light whether the OS is in dark mode
or not - this is not a bug to chase down screen-by-screen right now; it's the expected state until
that screen's own stage is implemented. This file will be updated as each stage lands.
