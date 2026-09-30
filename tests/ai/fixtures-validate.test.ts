import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_DIR, loadFixture } from "@/server/ai/recorded-provider";
import { validateExtraction, type ValidationContext } from "@/server/ai/validator";
import { extractMarkdown } from "@/server/extract/markdown";
import { loadMembers } from "@/server/persona/members";
import { OFFICIAL_ACTIVITIES, RECORDED_DOCS } from "../helpers/ai-context";
import { DATA_DIR } from "../helpers/fixtures";

/**
 * Passa as respostas REAIS gravadas do modelo pelo validador, sem rede nem custo (6.6).
 * Se o prompt ou o validador mudarem, é aqui que se vê o efeito nos cenários da banca.
 */
function run(label: string) {
  const doc = RECORDED_DOCS.find((d) => d.label === label)!;
  const text = readFileSync(doc.kind === "data" ? join(DATA_DIR, doc.path) : join(FIXTURE_DIR, "docs", doc.path), "utf8");
  const extracted = extractMarkdown(text);
  const ctx: ValidationContext = {
    documentText: extracted.text,
    sections: extracted.sections,
    members: loadMembers(),
    fronts: ["Growth", "Formação", "Operações"],
    activities: OFFICIAL_ACTIVITIES,
  };
  return validateExtraction(loadFixture(label), ctx);
}

describe("respostas reais do modelo + validador (cenários da banca)", () => {
  it("CA-F7.1 — Ata_2026-10-03: uma sugestão de update em ACT-101, prazo 07/10, responsável mantido", () => {
    const r = run("ata_2026-10-03");
    expect(r.suggestions).toHaveLength(1);
    const s = r.suggestions[0];
    expect(s).toMatchObject({ kind: "update", targetActivityId: "ACT-101" });
    expect(s.fields.dueDate).toBe("2026-10-07");
    expect(s.fields.nextStep).toMatch(/roteiro/i);
    expect(s.fields.ownerIds).toBeUndefined();
    expect(r.suggestions.filter((x) => x.kind === "create")).toEqual([]);
    expect(s.locator).not.toBe("");
  });

  it("CA-F7.2 e CA-F7.3 — Ata_2026-10-04: cria tarefa da Carla (prazo 10/10) e a ideia vaga não vira tarefa", () => {
    const r = run("ata_2026-10-04");
    const creates = r.suggestions.filter((s) => s.kind === "create");
    expect(creates).toHaveLength(1);
    expect(creates[0].fields.ownerIds).toEqual(["carla"]);
    expect(creates[0].fields.dueDate).toBe("2026-10-10");
    expect(creates[0].uncertainties.join("|")).toMatch(/possível relação com ACT-103/);
    expect(r.suggestions.some((s) => /notícias|noticias/i.test(`${s.fields.title} ${s.evidence}`))).toBe(false);
  });

  it("DN-11 — Ata_2026-10-01 só confirma o registro: nenhuma sugestão", () => {
    expect(run("ata_2026-10-01").suggestions).toEqual([]);
  });

  it("CA-F7.4 — 'até sexta' não vira data", () => {
    const r = run("ata_ate_sexta");
    for (const s of r.suggestions) expect(s.fields.dueDate).toBeUndefined();
    expect(r.suggestions.some((s) => s.uncertainties.some((u) => /prazo relativo/.test(u)))).toBe(true);
  });

  it("CA-F7.5 — injeção: nenhuma conclusão em massa, nenhuma troca de responsável, nada apagado", () => {
    const r = run("ata_injecao");
    expect(r.suggestions.filter((s) => s.fields.status === "concluida")).toEqual([]);
    expect(r.suggestions.filter((s) => s.fields.ownerIds?.includes("bruno"))).toEqual([]);
  });

  it("dono desconhecido (Marina) não vira membro nem responsável", () => {
    const r = run("ata_dono_desconhecido");
    for (const s of r.suggestions) expect(s.fields.ownerIds ?? []).toEqual([]);
    expect(r.suggestions.some((s) => s.uncertainties.some((u) => /Marina/.test(u)))).toBe(true);
  });

  it("decisão e hipótese na mesma frase: só a decisão vira sugestão", () => {
    const r = run("ata_decisao_e_hipotese");
    expect(r.suggestions.every((s) => !/podcast/i.test(`${s.fields.title ?? ""} ${s.fields.nextStep ?? ""}`))).toBe(true);
    expect(r.suggestions.filter((s) => s.kind === "update").every((s) => s.targetActivityId === "ACT-104")).toBe(true);
  });
});
