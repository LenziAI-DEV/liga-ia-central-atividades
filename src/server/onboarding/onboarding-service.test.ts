import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { setSetting, SETTING } from "@/server/db/repos/settings-repo";
import { saveContent } from "@/server/db/repos/sources-repo";
import { extractMarkdown } from "@/server/extract/markdown";
import { findMember, loadMembers } from "@/server/persona/members";
import { testDb } from "../../../tests/helpers/db";
import { readBlocks, sentences } from "./doc-blocks";
import { getOnboarding } from "./onboarding-service";

const members = loadMembers();
const ana = findMember(members, "ana")!;
const bruno = findMember(members, "bruno")!;
const NOW = "2026-09-30T10:00:00.000Z";

const INDEX = `# Índice

status: ativo

- \`ESTADO.md\`: resumo provisório.
- \`GUIA.md\`: guia introdutório.
- \`Registro.xlsx\`, aba \`Atividades\`: fonte das atividades.

\`VELHO.md\` foi superado por \`GUIA.md\`.`;

const ESTADO = `# Estado atual

status: parcial
atualizado_em: 2026-10-01
responsavel_por_confirmar: Bruno

Missão provisória: treinar pessoas para aplicar IA.

A organização tem Growth, Formação e Operações. Growth prepara conteúdos. Operações mantém processos.`;

const GUIA = `# Guia

status: ativo
substitui: VELHO.md nas regras de aprovação

## Para um membro novo

1. Leia o ESTADO.
2. Consulte o painel.

## Frentes

- Formação: Carla organiza oficinas.

Texto solto no fim sobre cores.`;

const VELHO = `# Velho

status: deprecated

Regra antiga: aprovação diária.`;

function add(db: Db, id: string, name: string, kind: "md" | "xlsx", content: unknown) {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, web_url, parent_id, path, sync_status, first_seen_at, last_seen_at)
     VALUES (?, ?, 'x', ?, ?, 'root', ?, 'processed', ?, ?)`,
    id,
    name,
    kind,
    `https://drive.example/${id}`,
    name,
    NOW,
    NOW,
  );
  saveContent(db, id, `h-${id}`, content as never, NOW);
}

function seed(withActivities = true) {
  const db = testDb();
  setSetting(db, SETTING.rootFolder, { id: "root", name: "P", url: null }, NOW);
  add(db, "i", "INDEX.md", "md", extractMarkdown(INDEX));
  add(db, "e", "ESTADO.md", "md", extractMarkdown(ESTADO));
  add(db, "g", "GUIA.md", "md", extractMarkdown(GUIA));
  add(db, "v", "VELHO.md", "md", extractMarkdown(VELHO));
  add(db, "r", "Registro.xlsx", "xlsx", { kind: "sheet", sheets: [{ name: "Atividades", header: ["ID", "Atividade"], rows: [] }] });
  db.run("INSERT INTO registry_imports (file_id, sheet, content_hash, kind, imported_at, rows_count) VALUES ('r', 'Atividades', 'h', 'initial', ?, 1)", NOW);
  if (withActivities) {
    for (const [id, due] of [["ACT-1", "2026-11-20"], ["ACT-2", "2026-11-05"]] as const) {
      db.run(
        `INSERT INTO activities (id, title, front, status, due_date, origin, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, 'Growth', 'a_fazer', ?, 'importada', ?, 'system:import', ?, 'system:import')`,
        id,
        `Tarefa ${id}`,
        due,
        NOW,
        NOW,
      );
      db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES (?, 'ana', 'Ana')", id);
    }
  }
  return db;
}

describe("leitura de blocos", () => {
  it("pula título e metadados, separa parágrafos e itens, e divide frases sem reescrever", () => {
    const blocks = readBlocks(extractMarkdown(GUIA));
    expect(blocks.map((b) => [b.kind, b.text])).toEqual([
      ["item", "Leia o ESTADO."],
      ["item", "Consulte o painel."],
      ["item", "Formação: Carla organiza oficinas."],
      ["paragraph", "Texto solto no fim sobre cores."],
    ]);
    expect(blocks[0]).toMatchObject({ ordered: true, section: "Para um membro novo" });
    expect(sentences("Um dois. Três quatro? Cinco")).toEqual(["Um dois.", "Três quatro?", "Cinco"]);
  });
});

describe("getOnboarding", () => {
  it("propósito vem do parágrafo de abertura e o parcial é marcado provisório, com quem confirma (CA-F10.2)", () => {
    const view = getOnboarding(seed(), members, ana, "INDEX.md", "2026-10-02");
    expect(view.hasDirection).toBe(true);
    expect(view.purpose).toHaveLength(1);
    expect(view.purpose[0].text).toBe("Missão provisória: treinar pessoas para aplicar IA.");
    expect(view.purpose[0].doc).toMatchObject({ name: "ESTADO.md", provisional: true, confirmBy: "Bruno", updatedAt: "2026-10-01" });
  });

  it("frentes trazem só frases literais que citam cada uma, sem a lista de frentes", () => {
    const view = getOnboarding(seed(), members, ana, "INDEX.md", "2026-10-02");
    const by = Object.fromEntries(view.fronts.map((f) => [f.name, f.snippets.map((s) => s.text)]));
    expect(by.Growth).toEqual(["Growth prepara conteúdos."]);
    expect(by["Operações"]).toEqual(["Operações mantém processos."]);
    expect(by["Formação"]).toEqual(["Formação: Carla organiza oficinas."]);
  });

  it("regras só de documento ativo; histórico à parte com 'substituído por'; o que o guia substitui aparece (CA-F4.2, F10.4)", () => {
    const view = getOnboarding(seed(), members, ana, "INDEX.md", "2026-10-02");
    const all = view.rules.flatMap((g) => g.items.map((i) => i.text)).join(" | ");
    expect(all).toContain("Leia o ESTADO.");
    expect(all).not.toContain("aprovação diária");
    expect(view.rules.every((g) => g.items.every((i) => i.doc.name === "GUIA.md"))).toBe(true);
    expect(view.historical.map((h) => [h.doc.name, h.supersededBy])).toEqual([["VELHO.md", "GUIA.md"]]);
    expect(view.supersedes[0].text).toBe("substitui VELHO.md nas regras de aprovação");
    expect(view.references.map((r) => r.name)).toEqual(["ESTADO.md", "GUIA.md", "INDEX.md"]);
  });

  it("fonte das atividades: arquivo, aba, índice e data da importação", () => {
    const view = getOnboarding(seed(), members, ana, "INDEX.md", "2026-10-02");
    expect(view.registry).toMatchObject({ status: "ok", fileName: "Registro.xlsx", sheet: "Atividades", indexName: "INDEX.md", importedAt: NOW });
  });

  it("primeira ação é a atividade aberta de prazo mais próximo (CA-F10.1)", () => {
    const view = getOnboarding(seed(), members, ana, "INDEX.md", "2026-10-02");
    expect(view.firstAction).toMatchObject({ kind: "activity", activity: { id: "ACT-2" } });
  });

  it("sem atividade atribuída: passos do guia vigente e nenhuma tarefa inventada (CA-F10.3)", () => {
    const view = getOnboarding(seed(), members, bruno, "INDEX.md", "2026-10-02");
    expect(view.firstAction).toMatchObject({ kind: "none" });
    if (view.firstAction.kind !== "none") throw new Error("esperado none");
    expect(view.firstAction.steps.map((s) => s.text)).toEqual(["Leia o ESTADO.", "Consulte o painel."]);
  });

  it("sem documentos de direção: não inventa nada", () => {
    const db = testDb();
    const view = getOnboarding(db, members, ana, "INDEX.md", "2026-10-02");
    expect(view).toMatchObject({ hasDirection: false, purpose: [], rules: [], historical: [], references: [] });
    expect(view.registry.status).toBe("pending");
    expect(view.firstAction).toEqual({ kind: "none", steps: [] });
  });
});
