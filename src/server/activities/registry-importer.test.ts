import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/lib/datetime";
import { resolveRegistry } from "@/server/authority/registry-locator";
import type { Db } from "@/server/db/client";
import { setSetting, SETTING } from "@/server/db/repos/settings-repo";
import { saveContent } from "@/server/db/repos/sources-repo";
import { extractMarkdown } from "@/server/extract/markdown";
import { extractXlsx } from "@/server/extract/xlsx";
import type { Extracted, Sheet } from "@/server/extract/types";
import { loadMembers } from "@/server/persona/members";
import { fixtureBytes, fixtureText } from "../../../tests/helpers/fixtures";
import { testDb } from "../../../tests/helpers/db";
import { importInitialRegistry } from "./registry-importer";

const NOW = "2026-09-30T10:00:00.000Z";
const clock = fixedClock(NOW);
const members = loadMembers();

function addSource(db: Db, id: string, name: string, kind: "md" | "xlsx", content?: Extracted) {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, parent_id, path, sync_status, drive_version, first_seen_at, last_seen_at)
     VALUES (?, ?, 'x', ?, 'root', ?, 'processed', '7', ?, ?)`,
    id,
    name,
    kind,
    name,
    NOW,
    NOW,
  );
  if (content) saveContent(db, id, `h-${id}`, content, NOW);
}

const cell = (address: string, text: string, date?: string) => ({ address, text, raw: text, ...(date ? { date } : {}) });

function sheetOf(name: string, header: string[], rows: string[][]): Extracted {
  const sheet: Sheet = {
    name,
    header,
    rows: rows.map((values, i) => ({
      rowNumber: i + 2,
      cells: Object.fromEntries(
        values.flatMap((v, c) => (v === "" ? [] : [[header[c], cell(`${String.fromCharCode(65 + c)}${i + 2}`, v)]])),
      ),
    })),
  };
  return { kind: "sheet", sheets: [sheet] };
}

const rows = (db: Db) =>
  db.all<{ id: string; status: string | null; due_date: string | null; front: string | null }>(
    "SELECT id, status, due_date, front FROM activities ORDER BY id",
  );
const ownersOf = (db: Db, id: string) =>
  db.all<{ member_id: string | null; raw_name: string }>(
    "SELECT member_id, raw_name FROM activity_owners WHERE activity_id = ? ORDER BY raw_name",
    id,
  );

describe("importInitialRegistry", () => {
  let db: Db;
  beforeEach(() => {
    db = testDb();
    setSetting(db, SETTING.rootFolder, { id: "root", name: "Pasta", url: null }, NOW);
  });

  it("importa o registro real: ACT-101…104, responsáveis, ACT-103 bloqueada, prazos como data pura (V-1)", async () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown(fixtureText("01_CARGA_INICIAL/INDEX.md")));
    addSource(db, "r", "Ata_registro.xlsx", "xlsx", await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx")));
    addSource(db, "a1", "Ata_2026-10-01.md", "md");

    const result = importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock);
    expect(result).toMatchObject({ status: "imported", imported: 4, issues: [] });

    expect(rows(db)).toEqual([
      { id: "ACT-101", status: "em_andamento", due_date: "2026-10-05", front: "Growth" },
      { id: "ACT-102", status: "a_fazer", due_date: "2026-10-06", front: "Operações" },
      { id: "ACT-103", status: "bloqueada", due_date: "2026-10-09", front: "Formação" },
      { id: "ACT-104", status: "a_fazer", due_date: "2026-10-11", front: "Operações" },
    ]);
    expect(ownersOf(db, "ACT-101").map((o) => o.member_id)).toEqual(["ana"]);
    expect(ownersOf(db, "ACT-102").map((o) => o.member_id)).toEqual(["davi"]);
    expect(ownersOf(db, "ACT-103").map((o) => o.member_id)).toEqual(["carla"]);
    expect(ownersOf(db, "ACT-104").map((o) => o.member_id).sort()).toEqual(["ana", "davi"]);

    const events = db.all<{ kind: string; actor_id: string }>("SELECT kind, actor_id FROM activity_events");
    expect(events).toHaveLength(4);
    expect(events.every((e) => e.kind === "imported" && e.actor_id === "system:import")).toBe(true);
    const refs = db.all<{ relation: string; locator: string }>(
      "SELECT relation, locator FROM activity_references WHERE activity_id = 'ACT-101' ORDER BY relation",
    );
    expect(refs).toEqual([
      { relation: "historical_origin", locator: "Atividades!I2" },
      { relation: "imported_from", locator: "Atividades!A2:J2" },
    ]);
    expect(db.get("SELECT authority_class FROM sources WHERE file_id = 'r'")).toEqual({ authority_class: "registro_vigente" });
  });

  it("é idempotente: a segunda importação não muda nada", async () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown(fixtureText("01_CARGA_INICIAL/INDEX.md")));
    addSource(db, "r", "Ata_registro.xlsx", "xlsx", await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx")));
    const resolution = resolveRegistry(db, "INDEX.md");
    importInitialRegistry(db, resolution, members, clock);
    expect(importInitialRegistry(db, resolution, members, clock)).toEqual({ status: "already_imported" });
    expect(rows(db)).toHaveLength(4);
    expect(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM activity_events")?.n).toBe(4);
  });

  it("a cópia vazia homônima não é importada nem apaga nada (CA-F4.1)", async () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown(fixtureText("01_CARGA_INICIAL/INDEX.md")));
    addSource(db, "r", "Ata_registro.xlsx", "xlsx", await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx")));
    importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock);
    addSource(
      db,
      "c",
      "Ata - copia vazia.xlsx",
      "xlsx",
      await extractXlsx(fixtureBytes("03_CONFLITO/Ata - copia vazia.xlsx")),
    );
    expect(importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock)).toEqual({
      status: "already_imported",
    });
    expect(rows(db)).toHaveLength(4);
  });

  it("variante: outros IDs, cabeçalhos com sinônimos, apelido, dono desconhecido e estado desconhecido", () => {
    const withAlias = members.map((m) => (m.id === "davi" ? { ...m, aliases: ["Dav"] } : m));
    addSource(db, "i", "indice.md", "md", extractMarkdown("fonte das atividades: `Tarefas.xlsx`, aba `Painel`"));
    addSource(
      db,
      "t",
      "Tarefas.xlsx",
      "xlsx",
      sheetOf(
        "Painel",
        ["Código", "Tarefa", "Dono", "Vencimento", "Área", "Situação"],
        [
          ["T-9", "Escrever roteiro", "Dav; Fulano", "12/10/2026", "Operações", "Concluída"],
          ["T-10", "Revisar", "ANA", "quando der", "Growth", "Em revisão"],
          ["", "", "", "", "", ""],
          ["T-9", "Duplicada", "Ana", "", "", ""],
          ["", "Sem id", "Ana", "", "", ""],
        ],
      ),
    );
    const result = importInitialRegistry(db, resolveRegistry(db, "indice.md"), withAlias, clock);
    expect(result.status).toBe("imported");
    expect(rows(db)).toEqual([
      { id: "T-10", status: null, due_date: null, front: "Growth" },
      { id: "T-9", status: "concluida", due_date: "2026-10-12", front: "Operações" },
    ]);
    expect(ownersOf(db, "T-9")).toEqual([
      { member_id: "davi", raw_name: "Dav" },
      { member_id: null, raw_name: "Fulano" },
    ]);
    expect(ownersOf(db, "T-10").map((o) => o.member_id)).toEqual(["ana"]);
    if (result.status !== "imported") throw new Error("esperado imported");
    const messages = result.issues.map((i) => i.message);
    expect(messages).toHaveLength(4);
    expect(messages[0]).toContain('estado "Em revisão"');
    expect(messages[1]).toContain('prazo "quando der"');
    expect(messages[2]).toContain("repetido");
    expect(messages[3]).toContain("sem ID");
  });

  it("planilha sem coluna de ID ou de título é recusada sem gravar", () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown("fonte das atividades: `T.xlsx`, aba `A`"));
    addSource(db, "t", "T.xlsx", "xlsx", sheetOf("A", ["Coisa", "Outra"], [["x", "y"]]));
    expect(importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock)).toMatchObject({ status: "refused" });
    expect(rows(db)).toEqual([]);
    expect(db.get("SELECT 1 AS present FROM registry_imports")).toBeUndefined();
  });

  it("importação sem nenhuma linha válida não grava a marca e tenta de novo depois (R-3)", () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown("fonte das atividades: `T.xlsx`, aba `A`"));
    addSource(db, "t", "T.xlsx", "xlsx", sheetOf("A", ["ID", "Atividade"], [["X-1", ""], ["", "Sem id"]]));
    const first = importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock);
    expect(first).toMatchObject({ status: "refused" });
    if (first.status !== "refused") throw new Error("esperado refused");
    expect(first.issues).toHaveLength(2);
    expect(db.get("SELECT 1 AS present FROM registry_imports")).toBeUndefined();
    expect(db.get("SELECT authority_class FROM sources WHERE file_id = 't'")).toEqual({ authority_class: null });

    db.run("DELETE FROM source_contents WHERE file_id = 't'");
    saveContent(db, "t", "h2", sheetOf("A", ["ID", "Atividade"], [["X-1", "Agora com título"]]), NOW);
    expect(importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock)).toMatchObject({
      status: "imported",
      imported: 1,
    });
  });

  it("IDs que só diferem na caixa são a mesma atividade; linha sem título não consome o ID (R-8)", () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown("fonte das atividades: `T.xlsx`, aba `A`"));
    addSource(
      db,
      "t",
      "T.xlsx",
      "xlsx",
      sheetOf(
        "A",
        ["ID", "Atividade"],
        [
          ["LIA-001", ""],
          ["LIA-001", "Válida"],
          ["lia-001", "Repetida só na caixa"],
        ],
      ),
    );
    const result = importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock);
    expect(result).toMatchObject({ status: "imported", imported: 1 });
    expect(rows(db).map((r) => r.id)).toEqual(["LIA-001"]);
  });

  it("fonte não resolvida (pendência) não importa nada", () => {
    expect(importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock)).toMatchObject({ status: "refused" });
  });

  it("eventos são append-only: editar ou apagar é recusado pelo banco", async () => {
    addSource(db, "i", "INDEX.md", "md", extractMarkdown(fixtureText("01_CARGA_INICIAL/INDEX.md")));
    addSource(db, "r", "Ata_registro.xlsx", "xlsx", await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx")));
    importInitialRegistry(db, resolveRegistry(db, "INDEX.md"), members, clock);
    expect(() => db.run("UPDATE activity_events SET reason = 'x'")).toThrow(/append-only/);
    expect(() => db.run("DELETE FROM activity_events")).toThrow(/append-only/);
  });
});
