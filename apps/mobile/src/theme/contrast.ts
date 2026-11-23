/**
 * WCAG 2.x relative-luminance/contrast-ratio math - pure, no React/RN dependency, so it's
 * testable the same way packages/shared's formulas are (even though this lives in apps/mobile
 * since it's specific to this app's own ThemeColors, not a generally-shared formula). Used by
 * contrast.test.ts to pin real contrast ratios for both lightColors and darkColors rather than
 * just eyeballing a screenshot.
 */

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two colours, 1 (no contrast) to 21 (black on white). Order of the
 * two arguments doesn't matter - the lighter one is always put in the numerator internally. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.x AA thresholds - 4.5:1 for normal text, 3:1 for large text (18pt+/14pt+bold) and
 * meaningful UI graphics like icons/chart marks. */
export const WCAG_AA_NORMAL_TEXT = 4.5;
export const WCAG_AA_LARGE_TEXT = 3.0;
