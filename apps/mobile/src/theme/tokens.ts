/**
 * Design tokens for apps/mobile. Our own visual identity, inspired by (not copied from)
 * HealthifyMe's current "Brew" design system - see healthifyme-re/UI_UX.md for the teardown this
 * was inspired by: one calm brand colour + a warm neutral ramp + tabular numbers, instead of a
 * different colour per screen and a stack of plain buttons.
 *
 * Light and dark are independently tuned palettes sharing the same key set (`ThemeColors`), not
 * one palette with dark mode as an inversion - see docs/THEME_SYSTEM.md for the reasoning behind
 * each value. `ThemeProvider.tsx` picks between them at runtime; nothing outside `theme/` should
 * import `lightColors`/`darkColors` directly - use `useTheme()` instead (see its docstring for
 * the one exception: code that can't run inside a React tree, like the home-screen widget).
 */

/** Every colour is a plain `string` (not a literal-typed `as const`) so `lightColors` and
 * `darkColors` are both assignable to this one interface despite having different hex values -
 * otherwise TS would infer two incompatible literal-typed object shapes and the ternary in
 * ThemeProvider.tsx picking between them would fail to typecheck. `statusBarStyle` stays a real
 * union since its two values are meant to be exhaustive, not open strings. */
export interface ThemeColors {
  primary: string;
  primaryTonal: string;
  primaryDark: string;
  accent: string;
  accentTonal: string;
  protein: string;
  carb: string;
  fat: string;
  fibre: string;
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceAlt: string;
  stroke: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;
  error: string;
  errorTonal: string;
  success: string;
  successTonal: string;
  warning: string;
  warningTonal: string;
  disabled: string;
  scrim: string;
  statusBarStyle: "light" | "dark";
}

export const lightColors: ThemeColors = {
  // Brand
  primary: "#1F7A5A",
  primaryTonal: "#E6F2EC",
  primaryDark: "#15523C",
  // Gamification accent (streak flame, level chip, badges) - deliberately a different hue family
  // from the "carb" macro colour below (ember orange vs goldenrod) so the two never read as the
  // same signal at a glance (docs/UI_UX_AUDIT.md finding H2).
  accent: "#C8540E",
  accentTonal: "#FBEAE0",

  // Macro colors (used consistently for protein/carb/fat/fibre everywhere they appear). Each is a
  // distinct hue, not just a different shade of one family, so the four stay distinguishable for
  // colour-vision-deficient users even without relying on the text labels next to them.
  protein: "#3B6FE0",
  carb: "#B8860B",
  fat: "#E2633B",
  fibre: "#7A5AC8",

  // Neutrals (warm, not cool grey) - three surface steps give cards a tonal elevation instead of
  // relying only on a border stroke.
  bg: "#F6F5F3",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceAlt: "#F1EFEC",
  stroke: "#E6E2DE",
  separator: "#EDEAE6",

  // Text
  text: "#1A1714",
  textSecondary: "#6E6760",
  textTertiary: "#8C857C",
  textOnPrimary: "#FFFFFF",

  // State
  error: "#C62828",
  errorTonal: "#F8E6E5",
  success: "#1F7A5A",
  successTonal: "#E6F2EC",
  warning: "#B8860B",
  warningTonal: "#FBF1DA",
  disabled: "#C9C4BF",

  // Chrome (status bar / Android nav bar / overlays)
  scrim: "rgba(26,23,20,0.45)",
  statusBarStyle: "dark",
};

export const darkColors: ThemeColors = {
  // Brand - desaturated/lightened so it doesn't vibrate against a dark surface (checked for
  // contrast against the #1C1A17-family surfaces below, not just a lightness bump).
  primary: "#6FD9A8",
  primaryTonal: "#1C3A2C",
  primaryDark: "#9CEAC3",
  accent: "#F0956A",
  accentTonal: "#3B2518",

  protein: "#8AADF2",
  carb: "#E0B64D",
  fat: "#F0937A",
  fibre: "#B6A0E8",

  // Tonal elevation steps, stepped up from near-black rather than pure black (Material "surface
  // tint" idea) so cards read as raised without a harsh white border.
  bg: "#13120F",
  surface: "#1C1A17",
  surfaceRaised: "#26231F",
  surfaceAlt: "#231F1B",
  stroke: "#36322C",
  separator: "#2C2823",

  text: "#F2EEE8",
  textSecondary: "#B8B0A6",
  textTertiary: "#857C72",
  textOnPrimary: "#0D1F17",

  error: "#F3867E",
  errorTonal: "#3A1E1C",
  success: "#6FD9A8",
  successTonal: "#1C3A2C",
  warning: "#E0B64D",
  warningTonal: "#3B2F15",
  disabled: "#4A453F",

  scrim: "rgba(0,0,0,0.6)",
  statusBarStyle: "light",
};

export type ColorScheme = "light" | "dark";

/** Static default (light) for code that can't read React context - currently only the
 * home-screen widget (`src/widget/*`), which renders through a headless native host, not inside
 * `<App />`. It picks `lightColors`/`darkColors` itself from `Appearance.getColorScheme()`; this
 * export exists only as a safe fallback import path. Everything else must use `useTheme()`. */
export const colors: ThemeColors = lightColors;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Android Material elevation values (the `elevation` prop, not a hand-rolled shadow) for the few
 * surfaces that should visibly float above the base card layer (bottom sheets, dialogs, the tab
 * bar). Cards themselves stay flat (stroke only), matching the existing restrained look. */
export const elevation = {
  level0: 0,
  level1: 1,
  level2: 3,
  level3: 6,
  level4: 8,
} as const;

/** Minimum interactive sizes (Android 48dp touch-target guidance - see docs/UI_UX_AUDIT.md C2).
 * Every new interactive primitive sizes itself from these rather than a one-off magic number. */
export const sizes = {
  touchTarget: 48,
  buttonHeight: 52,
  touchGap: 8,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 32,
} as const;

/** Shared animation durations (ms) - context-appropriate, not one duration for everything: fast
 * for immediate feedback (press states), base for most transitions, slow for a deliberate reveal
 * (bottom sheets). Respect reduced-motion (`AccessibilityInfo.isReduceMotionEnabled`) at the call
 * site, not here. */
export const motion = {
  fast: 120,
  base: 200,
  slow: 300,
} as const;

/** Font family names registered by useFonts() in App.tsx (apps/mobile/src/theme/fonts.ts). */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export interface TextVariant {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

/** Scale mirrors the teardown's weight-carries-hierarchy approach rather than a long list of
 * sizes. `display` is new (Stage 2) for hero numeric metrics (the Today calorie ring, Me's target
 * kcal) - previously those reused `h1` at 24px, undersized for a screen's single most important
 * number. `label` is new for form/field labels (slightly larger and bolder than `caption` so a
 * field label doesn't read as the same weight as helper text). `micro` (10px) is reserved for true
 * micro-captions (a unit suffix, a timestamp) - no screen should use it for anything a user needs
 * to read reliably; see docs/UI_UX_AUDIT.md C2. */
export const textVariants = {
  display: { fontFamily: fontFamily.bold, fontSize: 36, lineHeight: 42 },
  h1: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: fontFamily.semiBold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  captionMedium: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fontFamily.medium, fontSize: 10, lineHeight: 14 },
} satisfies Record<string, TextVariant>;

export type TextVariantName = keyof typeof textVariants;

/** Tabular figures for metrics (kcal, grams, reps, weight) so numbers don't jitter as they
 * change - the teardown's "separate tabular-figure font" takeaway, done via RN's fontVariant. */
export const tabularNumbers = { fontVariant: ["tabular-nums" as const] };
