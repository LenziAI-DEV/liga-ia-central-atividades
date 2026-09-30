import { describe, expect, it } from "vitest";
import { displayQuote } from "./field-format";

describe("displayQuote", () => {
  it("tira negrito, crase e ênfase com sublinhado, mas preserva sublinhado de nome de arquivo", () => {
    expect(displayQuote("Consulte `Ata_registro.xlsx` e **o painel**.")).toBe("Consulte Ata_registro.xlsx e o painel.");
    expect(displayQuote("Isto é _muito importante_, sim.")).toBe("Isto é muito importante, sim.");
    expect(displayQuote("ACT_101 e snake_case_nome ficam")).toBe("ACT_101 e snake_case_nome ficam");
  });
});
