import { describe, expect, it } from "vitest";
import { fixtureText } from "../../../tests/helpers/fixtures";
import { parseIndex } from "./index-parser";

describe("parseIndex", () => {
  it("acha o registro e a aba no INDEX.md do acervo", () => {
    const pointers = parseIndex(fixtureText("01_CARGA_INICIAL/INDEX.md"));
    expect(pointers.registry).toEqual([expect.objectContaining({ fileName: "Ata_registro.xlsx", sheetName: "Atividades" })]);
    expect(pointers.superseded).toEqual(["PLANO_EDITORIAL_ANTIGO.md"]);
  });

  it("funciona com outro arquivo, outra aba e outra redação (sem depender do pacote de teste)", () => {
    const text = [
      "# Índice",
      "- `Fonte_das_tarefas.xlsx`, aba `Tarefas 2026`: FONTE oficial das atividades da liga.",
      "- `Regras_v2.md`: regras.",
      "O arquivo `Regras_v1.md` foi substituído por `Regras_v2.md`.",
    ].join("\n");
    const pointers = parseIndex(text);
    expect(pointers.registry).toEqual([expect.objectContaining({ fileName: "Fonte_das_tarefas.xlsx", sheetName: "Tarefas 2026" })]);
    expect(pointers.superseded).toEqual(["Regras_v1.md"]);
  });

  it("aba ausente vira null; linha sem arquivo ou sem 'fonte' e 'atividades' não conta", () => {
    expect(parseIndex("A fonte das atividades é `Registro.xlsx`.").registry[0]).toMatchObject({
      fileName: "Registro.xlsx",
      sheetName: null,
    });
    expect(parseIndex("A fonte das atividades é a planilha.").registry).toEqual([]);
    expect(parseIndex("- `Registro.xlsx`: modelo de planilha.").registry).toEqual([]);
    expect(parseIndex("Duas fontes ativas podem discordar; veja `x.md`.").registry).toEqual([]);
  });

  it("linhas enormes ou hostis não travam nem contam", () => {
    const hostile = `fonte atividades ${"`a".repeat(50_000)}`;
    const start = performance.now();
    expect(parseIndex(hostile).registry).toEqual([]);
    expect(performance.now() - start).toBeLessThan(300);
  });
});
