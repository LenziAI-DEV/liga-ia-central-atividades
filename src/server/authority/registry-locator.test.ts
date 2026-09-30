import { beforeEach, describe, expect, it } from "vitest";
import { fixtureText } from "../../../tests/helpers/fixtures";
import { testDb } from "../../../tests/helpers/db";
import type { Db } from "@/server/db/client";
import { setSetting, SETTING } from "@/server/db/repos/settings-repo";
import { saveContent } from "@/server/db/repos/sources-repo";
import type { Extracted } from "@/server/extract/types";
import { extractMarkdown } from "@/server/extract/markdown";
import { resolveRegistry } from "./registry-locator";

const NOW = "2026-09-30T10:00:00.000Z";
const ROOT = "root";

function addSource(
  db: Db,
  id: string,
  name: string,
  kind: "md" | "xlsx",
  opts: { parent?: string; status?: string; content?: Extracted } = {},
) {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, parent_id, path, sync_status, first_seen_at, last_seen_at)
     VALUES (?, ?, 'x', ?, ?, ?, ?, ?, ?)`,
    id,
    name,
    kind,
    opts.parent ?? ROOT,
    name,
    opts.status ?? "processed",
    NOW,
    NOW,
  );
  if (opts.content) saveContent(db, id, `h-${id}`, opts.content, NOW);
}

const sheet = (name: string): Extracted => ({
  kind: "sheet",
  sheets: [{ name, header: ["ID"], rows: [] }],
});
const indexOf = (text: string) => extractMarkdown(text);

describe("resolveRegistry", () => {
  let db: Db;
  beforeEach(() => {
    db = testDb();
    setSetting(db, SETTING.rootFolder, { id: ROOT, name: "Pasta", url: null }, NOW);
  });

  it("acha o registro apontado pelo índice do acervo, ignorando a cópia vazia homônima", () => {
    addSource(db, "i", "INDEX.md", "md", { content: indexOf(fixtureText("01_CARGA_INICIAL/INDEX.md")) });
    addSource(db, "r", "Ata_registro.xlsx", "xlsx", { content: sheet("Atividades") });
    addSource(db, "c", "Ata - copia vazia.xlsx", "xlsx", { content: sheet("Ata") });
    const result = resolveRegistry(db, "INDEX.md");
    expect(result).toMatchObject({ status: "ok", source: { file_id: "r" }, sheet: { name: "Atividades" } });
  });

  it("variante: outro nome de índice, arquivo e aba", () => {
    addSource(db, "i", "leia-me-indice.md", "md", {
      content: indexOf("- `Tarefas_da_liga.xlsx`, aba `Painel`: fonte das atividades.\n"),
    });
    addSource(db, "r", "Tarefas_da_liga.xlsx", "xlsx", { parent: "sub", content: sheet("Painel") });
    expect(resolveRegistry(db, "LEIA-ME-INDICE.md")).toMatchObject({ status: "ok", source: { file_id: "r" } });
  });

  it("sem índice, índice fora da raiz ou duplicado: pendência, nada escolhido", () => {
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ status: "pending", problem: "no_index" });
    addSource(db, "i1", "INDEX.md", "md", { parent: "sub", content: indexOf("x") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "no_index" });
    addSource(db, "i2", "INDEX.md", "md", { content: indexOf("x") });
    addSource(db, "i3", "index.MD", "md", { content: indexOf("x") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "index_ambiguous" });
  });

  it("índice sem apontamento: pendência com motivo", () => {
    addSource(db, "i", "INDEX.md", "md", { content: indexOf("sem nada útil") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "no_pointer" });
  });

  it("índice que aponta dois arquivos: pendência, nenhum é escolhido", () => {
    addSource(db, "i", "INDEX.md", "md", {
      content: indexOf("fonte das atividades: `A.xlsx`\nfonte das atividades: `B.xlsx`"),
    });
    addSource(db, "a", "A.xlsx", "xlsx", { content: sheet("Atividades") });
    addSource(db, "b", "B.xlsx", "xlsx", { content: sheet("Atividades") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "pointer_ambiguous" });
  });

  it("índice que aponta arquivo ausente: pendência", () => {
    addSource(db, "i", "INDEX.md", "md", { content: indexOf("fonte das atividades: `A.xlsx`") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "file_not_found" });
  });

  it("dois arquivos com o nome apontado: pendência", () => {
    addSource(db, "i", "INDEX.md", "md", { content: indexOf("fonte das atividades: `A.xlsx`, aba `Atividades`") });
    addSource(db, "a1", "A.xlsx", "xlsx", { content: sheet("Atividades") });
    addSource(db, "a2", "A.xlsx", "xlsx", { parent: "sub", content: sheet("Atividades") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "file_ambiguous" });
  });

  it("aba inexistente e arquivo ainda não lido não importam nada", () => {
    addSource(db, "i", "INDEX.md", "md", { content: indexOf("fonte das atividades: `A.xlsx`, aba `Atividades`") });
    addSource(db, "a", "A.xlsx", "xlsx", { content: sheet("Outra") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "sheet_missing" });
    db.run("UPDATE sources SET sync_status = 'pending' WHERE file_id = 'a'");
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "file_not_read" });
  });

  it("arquivo indisponível ou fora da pasta não conta como candidato", () => {
    addSource(db, "i", "INDEX.md", "md", { content: indexOf("fonte das atividades: `A.xlsx`, aba `Atividades`") });
    addSource(db, "a", "A.xlsx", "xlsx", { status: "unavailable", content: sheet("Atividades") });
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ problem: "file_not_found" });
  });
});
