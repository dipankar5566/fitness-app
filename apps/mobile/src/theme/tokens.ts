/**
 * Design tokens for apps/mobile. Our own visual identity, inspired by (not copied from)
 * HealthifyMe's current "Brew" design system - see healthifyme-re/UI_UX.md for the teardown this
 * was inspired by: one calm brand colour + a warm neutral ramp + tabular numbers, instead of a
 * different colour per screen and a stack of plain buttons.
 */

export const colors = {
  // Brand
  primary: "#1F7A5A",
  primaryTonal: "#E6F2EC",
  primaryDark: "#15523C",
  accent: "#E0A100",
  accentTonal: "#FBF1DA",

  // Macro colors (used consistently for protein/carb/fat/fibre everywhere they appear)
  protein: "#3B6FE0",
  carb: "#E0A100",
  fat: "#E2633B",
  fibre: "#7A5AC8",

  // Neutrals (warm, not cool grey)
  bg: "#F6F5F3",
  surface: "#FFFFFF",
  surfaceAlt: "#F1EFEC",
  stroke: "#E6E2DE",
  separator: "#EDEAE6",

  // Text
  text: "#1A1714",
  textSecondary: "#6E6760",
  textTertiary: "#A29B94",
  textOnPrimary: "#FFFFFF",

  // State
  error: "#C62828",
  errorTonal: "#F8E6E5",
  success: "#1F7A5A",
  successTonal: "#E6F2EC",
  warning: "#B8860B",
  warningTonal: "#FBF1DA",
  disabled: "#C9C4BF",
} as const;

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

/** Scale mirrors the teardown's weight-carries-hierarchy approach (24/20/16/14/12/10) rather
 * than a long list of sizes. */
export const textVariants = {
  h1: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: fontFamily.semiBold, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  captionMedium: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fontFamily.medium, fontSize: 10, lineHeight: 14 },
} satisfies Record<string, TextVariant>;

export type TextVariantName = keyof typeof textVariants;

/** Tabular figures for metrics (kcal, grams, reps, weight) so numbers don't jitter as they
 * change - the teardown's "separate tabular-figure font" takeaway, done via RN's fontVariant. */
export const tabularNumbers = { fontVariant: ["tabular-nums" as const] };
