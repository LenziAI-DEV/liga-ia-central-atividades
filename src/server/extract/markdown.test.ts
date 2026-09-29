import { describe, expect, it } from "vitest";
import { fixtureText } from "../../../tests/helpers/fixtures";
import { extractMarkdown } from "./markdown";
import { contentHash } from "./normalize";

describe("extractMarkdown", () => {
  it("lê título, seções e metadados do INDEX.md", () => {
    const doc = extractMarkdown(fixtureText("01_CARGA_INICIAL/INDEX.md"));
    expect(doc.title).toBe("Índice do acervo de demonstração");
    expect(doc.metadata).toMatchObject({ status: "ativo", atualizado_em: "2026-10-01" });
    expect(doc.sections.map((s) => s.heading)).toContain("Comece por aqui");
  });

  it("identifica documento superado e parcial pelos metadados", () => {
    expect(extractMarkdown(fixtureText("01_CARGA_INICIAL/PLANO_EDITORIAL_ANTIGO.md")).metadata).toMatchObject({
      status: "deprecated",
      substituido_por: "GUIA_INICIAL.md em 2026-10-01",
    });
    expect(extractMarkdown(fixtureText("01_CARGA_INICIAL/ESTADO-ATUAL.md")).metadata).toMatchObject({
      status: "parcial",
      responsavel_por_confirmar: "Bruno",
    });
  });

  it("lê a data da reunião de uma ata", () => {
    const ata = extractMarkdown(fixtureText("02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md"));
    expect(ata.metadata.data_da_reuniao).toBe("2026-10-03");
    expect(ata.text).toContain("mudou de 2026-10-05 para **2026-10-07**");
  });

  it("não confunde frases com dois-pontos no corpo com metadados", () => {
    const ata = extractMarkdown(fixtureText("01_CARGA_INICIAL/Ata_2026-10-01.md"));
    expect(Object.keys(ata.metadata)).toEqual(["status", "data_da_reuniao"]);
  });

  it("aceita o formato do export de Google Doc (escapes e ênfase)", () => {
    const doc = extractMarkdown("# **Ata de reunião**\n\nstatus: ativo\ndata\\_da\\_reuniao: 2026-10-03\n\n## Mudança\n\ntexto");
    expect(doc.title).toBe("Ata de reunião");
    expect(doc.metadata).toEqual({ status: "ativo", data_da_reuniao: "2026-10-03" });
  });

  it("o hash não muda com CRLF, BOM ou espaços no fim da linha", () => {
    const a = extractMarkdown("# T\n\nstatus: ativo\n\ntexto");
    const b = extractMarkdown("﻿# T  \r\n\r\nstatus: ativo \r\n\r\ntexto\r\n");
    expect(contentHash(a)).toBe(contentHash(b));
  });
});
