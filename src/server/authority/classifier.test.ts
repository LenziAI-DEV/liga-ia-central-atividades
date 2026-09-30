import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { setSetting, SETTING } from "@/server/db/repos/settings-repo";
import { saveContent } from "@/server/db/repos/sources-repo";
import { extractMarkdown } from "@/server/extract/markdown";
import { extractXlsx } from "@/server/extract/xlsx";
import type { Extracted } from "@/server/extract/types";
import { fixtureBytes, fixtureText } from "../../../tests/helpers/fixtures";
import { testDb } from "../../../tests/helpers/db";
import { authorityLabel, classifySources } from "./classifier";

const NOW = "2026-09-30T10:00:00.000Z";

function add(db: Db, id: string, name: string, kind: "md" | "xlsx", content?: Extracted, parent = "root") {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, parent_id, path, sync_status, first_seen_at, last_seen_at)
     VALUES (?, ?, 'x', ?, ?, ?, 'processed', ?, ?)`,
    id,
    name,
    kind,
    parent,
    name,
    NOW,
    NOW,
  );
  if (content) saveContent(db, id, `h-${id}`, content, NOW);
}

const md = (path: string) => extractMarkdown(fixtureText(path));
const sheetOf = (name: string, header: string[], rows: string[][]): Extracted => ({
  kind: "sheet",
  sheets: [
    {
      name,
      header,
      rows: rows.map((values, i) => ({
        rowNumber: i + 2,
        cells: Object.fromEntries(values.flatMap((v, c) => (v === "" ? [] : [[header[c], { address: `${c}${i}`, text: v, raw: v }]]))),
      })),
    },
  ],
});

async function loadInitial(db: Db) {
  add(db, "idx", "INDEX.md", "md", md("01_CARGA_INICIAL/INDEX.md"));
  add(db, "reg", "Ata_registro.xlsx", "xlsx", await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx")));
  add(db, "est", "ESTADO-ATUAL.md", "md", md("01_CARGA_INICIAL/ESTADO-ATUAL.md"));
  add(db, "gui", "GUIA_INICIAL.md", "md", md("01_CARGA_INICIAL/GUIA_INICIAL.md"));
  add(db, "a01", "Ata_2026-10-01.md", "md", md("01_CARGA_INICIAL/Ata_2026-10-01.md"), "atas");
  add(db, "pla", "PLANO_EDITORIAL_ANTIGO.md", "md", md("01_CARGA_INICIAL/PLANO_EDITORIAL_ANTIGO.md"));
}

describe("classifySources", () => {
  let db: Db;
  beforeEach(() => {
    db = testDb();
    setSetting(db, SETTING.rootFolder, { id: "root", name: "Pasta", url: null }, NOW);
  });

  it("classifica a carga inicial inteira (V-13): direção, registro, ata e histórico", async () => {
    await loadInitial(db);
    const c = classifySources(db, "INDEX.md");
    expect(c.get("idx")?.class).toBe("direcao_ativo");
    expect(c.get("reg")?.class).toBe("registro_vigente");
    expect(c.get("est")?.class).toBe("direcao_parcial");
    expect(c.get("gui")?.class).toBe("direcao_ativo");
    expect(c.get("a01")?.class).toBe("ata");
    expect(c.get("pla")).toMatchObject({ class: "historico", supersededBy: "GUIA_INICIAL.md em 2026-10-01" });
    expect(c.get("pla")?.reasons).toContain("o índice o declara superado");
  });

  it("homônimo vazio vira 'sem autoridade / possível conflito', com motivos calculados (V-5, CA-F4.1)", async () => {
    await loadInitial(db);
    add(db, "cop", "Ata - copia vazia.xlsx", "xlsx", await extractXlsx(fixtureBytes("03_CONFLITO/Ata - copia vazia.xlsx")));
    const copy = classifySources(db, "INDEX.md").get("cop")!;
    expect(copy).toMatchObject({ class: "sem_autoridade", possibleConflict: true });
    expect(authorityLabel(copy)).toBe("sem autoridade / possível conflito");
    expect(copy.reasons).toEqual(
      expect.arrayContaining(["não apontado pelo índice como fonte vigente", 'aba "Ata" ≠ "Atividades"', "0 registros"]),
    );
    expect(classifySources(db, "INDEX.md").get("reg")?.class).toBe("registro_vigente");
  });

  it("ata nova com data da reunião é ata; documento solto sem metadados é 'sem autoridade' sem alarme", async () => {
    await loadInitial(db);
    add(db, "a04", "Ata_2026-10-04.md", "md", md("02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-04.md"), "atas");
    add(db, "solto", "rascunho.md", "md", extractMarkdown("# Rascunho\n\nalgo"));
    add(db, "falso", "Regras.md", "md", extractMarkdown("# Regras\n\nstatus: ativo\n\ntexto"));
    const c = classifySources(db, "INDEX.md");
    expect(c.get("a04")?.class).toBe("ata");
    expect(c.get("solto")).toMatchObject({ class: "sem_autoridade", possibleConflict: false });
    // "status: ativo" sozinho não dá autoridade: precisa ser citado no índice.
    expect(c.get("falso")?.class).toBe("sem_autoridade");
    expect(c.get("falso")?.reasons).toContain("não citado no índice");
  });

  it("variante: outro índice, outros nomes; quem diz 'substitui' torna o outro histórico", () => {
    add(db, "i", "indice.md", "md", extractMarkdown("fonte das atividades: `Tarefas.xlsx`, aba `Painel`\n- `Novo.md`: regras\n"));
    add(db, "t", "Tarefas.xlsx", "xlsx", sheetOf("Painel", ["Código", "Tarefa"], [["T-1", "Algo"]]));
    add(db, "n", "Novo.md", "md", extractMarkdown("# Novo\n\nstatus: ativo\nsubstitui: Velho.md\n"));
    add(db, "v", "Velho.md", "md", extractMarkdown("# Velho\n\ntexto"));
    add(db, "p", "Tarefas (cópia).xlsx", "xlsx", sheetOf("Painel", ["Código", "Tarefa"], [["T-1", "Algo"], ["T-2", "Outro"]]));
    const c = classifySources(db, "indice.md");
    expect(c.get("i")?.class).toBe("direcao_ativo");
    expect(c.get("t")?.class).toBe("registro_vigente");
    expect(c.get("n")?.class).toBe("direcao_ativo");
    expect(c.get("v")).toMatchObject({ class: "historico", supersededBy: "Novo.md" });
    expect(c.get("p")).toMatchObject({ class: "sem_autoridade", possibleConflict: true });
    expect(c.get("p")?.reasons).toContain("2 registro(s)");
  });

  it("sem índice nem registro identificado, planilha com cara de registro é sinalizada", () => {
    add(db, "x", "Planilha qualquer.xlsx", "xlsx", sheetOf("A", ["ID", "Atividade"], [["1", "x"]]));
    const x = classifySources(db, "INDEX.md").get("x")!;
    expect(x.class).toBe("sem_autoridade");
    expect(x.possibleConflict).toBe(true);
    expect(x.reasons).toContain("não há registro vigente identificado");
  });
});
