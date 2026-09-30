import { describe, expect, it } from "vitest";
import { PALETTE, TEXT_PAIRS, contrastRatio } from "./contrast";

describe("contraste da paleta (CA-F12.2)", () => {
  it.each(TEXT_PAIRS)("$use: $text sobre $background ≥ 4,5:1", ({ text, background }) => {
    expect(contrastRatio(PALETTE[text], PALETTE[background])).toBeGreaterThanOrEqual(4.5);
  });

  it("ciano com texto branco é proibido (contraste insuficiente)", () => {
    expect(contrastRatio(PALETTE.paper, PALETTE.liaCyan)).toBeLessThan(4.5);
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
      "--lia-blue": PALETTE.liaBlue,
      "--lia-blue-dark": PALETTE.liaBlueDark,
      "--lia-cyan": PALETTE.liaCyan,
      "--lia-cyan-soft": PALETTE.liaCyanSoft,
      "--ink": PALETTE.ink,
      "--ink-muted": PALETTE.inkMuted,
      "--paper": PALETTE.paper,
      "--paper-alt": PALETTE.paperAlt,
      "--ok-ink": PALETTE.okInk,
      "--ok-bg": PALETTE.okBg,
      "--warn-ink": PALETTE.warnInk,
      "--warn-bg": PALETTE.warnBg,
      "--danger-ink": PALETTE.dangerInk,
      "--danger-bg": PALETTE.dangerBg,
    };
    for (const [name, hex] of Object.entries(tokens)) {
      expect(css, name).toContain(`${name}: ${hex.toLowerCase()};`);
    }
  });
});
