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
