import { describe, expect, it } from "vitest";
import { PALETTE, TEXT_PAIRS, contrastRatio } from "./contrast";

describe("contraste da paleta (CA-F12.2)", () => {
  it.each(TEXT_PAIRS)("$use: $text sobre $background ≥ 4,5:1", ({ text, background }) => {
    expect(contrastRatio(PALETTE[text], PALETTE[background])).toBeGreaterThanOrEqual(4.5);
  });

  it("o contorno dos campos tem ≥ 3:1 sobre as superfícies (WCAG 1.4.11)", () => {
    expect(contrastRatio(PALETTE.borderStrong, PALETTE.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(PALETTE.borderStrong, PALETTE.bg)).toBeGreaterThanOrEqual(3);
  });

  it("calcula valores conhecidos", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });
});

describe("paleta e globals.css", () => {
  it("os tokens do CSS são os mesmos valores da paleta testada", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    const tokens: Record<string, string> = {
      "--primary": PALETTE.primary,
      "--primary-hover": PALETTE.primaryHover,
      "--primary-soft": PALETTE.primarySoft,
      "--on-primary": PALETTE.onPrimary,
      "--bg": PALETTE.bg,
      "--surface": PALETTE.surface,
      "--surface-muted": PALETTE.surfaceMuted,
      "--border-strong": PALETTE.borderStrong,
      "--text": PALETTE.text,
      "--text-muted": PALETTE.textMuted,
      "--success-ink": PALETTE.successInk,
      "--success-bg": PALETTE.successBg,
      "--warning-ink": PALETTE.warningInk,
      "--warning-bg": PALETTE.warningBg,
      "--error-ink": PALETTE.errorInk,
      "--error-bg": PALETTE.errorBg,
    };
    for (const [name, hex] of Object.entries(tokens)) {
      expect(css, name).toContain(`${name}: ${hex.toLowerCase()};`);
    }
  });
});
