import { describe, expect, it } from "vitest";
import type { ActivityView } from "@/server/activities/activity-queries";
import { PRECEDENCE_RULE_TEXT } from "@/lib/precedence-rule";
import { resolvePrecedence, type PendingChange } from "./precedence-resolver";

const official: ActivityView = {
  id: "ACT-101",
  title: "Preparar carrossel",
  description: null,
  front: "Growth",
  status: "em_andamento",
  dueDate: "2026-10-05",
  nextStep: null,
  notes: null,
  priority: null,
  origin: "importada",
  version: 1,
  createdAt: "",
  createdBy: "system:import",
  updatedAt: "",
  updatedBy: "system:import",
  owners: [],
  sources: [],
};
const change = (id: number, field: string, value: unknown, file = "f1"): PendingChange => ({ suggestionId: id, field, value, sourceFileId: file });

describe("resolvePrecedence", () => {
  it("proposta pendente não muda o valor oficial; só aparece como pendência (regra 3)", () => {
    const r = resolvePrecedence(official, [change(1, "dueDate", "2026-10-07")], false);
    expect(r.official.dueDate).toBe("2026-10-05");
    expect(r.pending).toHaveLength(1);
    expect(r.conflicts).toEqual([]);
  });

  it("duas propostas diferentes para o mesmo campo = conflito visível, oficial intacto (regra 6)", () => {
    const r = resolvePrecedence(official, [change(1, "dueDate", "2026-10-07", "a"), change(2, "dueDate", "2026-10-09", "b")], false);
    expect(r.conflicts).toEqual([{ field: "dueDate", values: [expect.objectContaining({ sourceFileId: "a" }), expect.objectContaining({ sourceFileId: "b" })] }]);
    expect(r.official.dueDate).toBe("2026-10-05");
  });

  it("propostas iguais, ou de campos diferentes, não são conflito", () => {
    expect(resolvePrecedence(official, [change(1, "dueDate", "2026-10-07"), change(2, "dueDate", "2026-10-07", "b")], false).conflicts).toEqual([]);
    expect(resolvePrecedence(official, [change(1, "dueDate", "2026-10-07"), change(2, "nextStep", "x")], false).conflicts).toEqual([]);
  });

  it("marca desatualização quando a leitura do Drive está defasada", () => {
    expect(resolvePrecedence(official, [], true).staleness).toBe("possibly_stale");
    expect(resolvePrecedence(official, [], false).staleness).toBe("fresh");
  });

  it("o texto da regra tem os 6 níveis do PRD (mesma fonte para a tela e o README)", () => {
    expect(PRECEDENCE_RULE_TEXT).toHaveLength(6);
    expect(PRECEDENCE_RULE_TEXT[0].title).toMatch(/Decisão humana/);
  });
});
