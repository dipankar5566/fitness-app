import { describe, expect, it } from "vitest";
import { contrastRatio, WCAG_AA_LARGE_TEXT, WCAG_AA_NORMAL_TEXT } from "./contrast";
import { darkColors, lightColors, type ThemeColors } from "./tokens";

/**
 * Pins real WCAG contrast ratios for the actual palette values, for both themes, rather than
 * trusting a screenshot by eye (docs/UI_UX_AUDIT.md/DESIGN_SYSTEM.md both claimed "verified at
 * 4.5:1 or better" when the palettes were written - this is what actually checks that claim, and
 * catches it if a future token edit quietly breaks it).
 */
describe.each([
  ["light", lightColors],
  ["dark", darkColors],
])("%s theme contrast", (_name, colors: ThemeColors) => {
  it("primary text on the base background meets AA normal-text contrast", () => {
    expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("secondary text on the base background meets AA normal-text contrast", () => {
    expect(contrastRatio(colors.textSecondary, colors.bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("tertiary text (captions/hints, never the only carrier of critical info) meets at least AA large-text contrast", () => {
    expect(contrastRatio(colors.textTertiary, colors.bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE_TEXT);
  });

  it("primary text on the surface card background meets AA normal-text contrast", () => {
    expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("button label text on the primary brand colour meets AA normal-text contrast", () => {
    expect(contrastRatio(colors.textOnPrimary, colors.primary)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("error text on the base background meets AA normal-text contrast", () => {
    expect(contrastRatio(colors.error, colors.bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("every macro colour (protein/carb/fat/fibre) meets AA large-text/graphics contrast against the surface it's drawn on", () => {
    for (const macro of [colors.protein, colors.carb, colors.fat, colors.fibre] as const) {
      expect(contrastRatio(macro, colors.surface)).toBeGreaterThanOrEqual(WCAG_AA_LARGE_TEXT);
    }
  });
});
