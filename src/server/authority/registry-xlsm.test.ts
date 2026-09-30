import { describe, expect, it } from "vitest";
import { setSetting, SETTING } from "@/server/db/repos/settings-repo";
import { saveContent } from "@/server/db/repos/sources-repo";
import { classifyFile } from "@/server/drive/classify-file";
import { extractMarkdown } from "@/server/extract/markdown";
import { testDb } from "../../../tests/helpers/db";
import { resolveRegistry } from "./registry-locator";

const NOW = "2026-09-30T10:00:00.000Z";
const sheet = (name: string) => ({ kind: "sheet" as const, sheets: [{ name, header: ["ID", "Atividade"], rows: [] }] });

function addSource(db: ReturnType<typeof testDb>, id: string, name: string, kind: "md" | "xlsx", content: unknown) {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, parent_id, path, sync_status, first_seen_at, last_seen_at)
     VALUES (?, ?, 'x', ?, 'root', ?, 'processed', ?, ?)`,
    id,
    name,
    kind,
    name,
    NOW,
    NOW,
  );
  saveContent(db, id, `h-${id}`, content as never, NOW);
}

describe("planilha salva como .xlsm (ex.: edição pelo Planilhas Google)", () => {
  it("o .xlsm é lido como planilha, pelo tipo e pela extensão", () => {
    expect(classifyFile({ name: "Registro.xlsm", mimeType: "application/vnd.ms-excel.sheet.macroenabled.12" }).kind).toBe("xlsx");
    expect(classifyFile({ name: "Registro.xlsm", mimeType: "application/octet-stream" }).kind).toBe("xlsx");
    expect(classifyFile({ name: "Registro.xlsb", mimeType: "application/octet-stream" }).kind).toBe("unsupported");
  });

  it("o índice cita .xlsx e a única planilha de mesmo nome-base agora é .xlsm: ainda é o registro", () => {
    const db = testDb();
    setSetting(db, SETTING.rootFolder, { id: "root", name: "P", url: null }, NOW);
    addSource(db, "i", "INDEX.md", "md", extractMarkdown("- `Registro.xlsx`, aba `Atividades`: fonte das atividades."));
    addSource(db, "r", "Registro.xlsm", "xlsx", sheet("Atividades"));
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ status: "ok", source: { file_id: "r" } });
  });

  it("duas planilhas com o mesmo nome-base, ou nome-base diferente: continua pendência (nada é escolhido)", () => {
    const db = testDb();
    setSetting(db, SETTING.rootFolder, { id: "root", name: "P", url: null }, NOW);
    addSource(db, "i", "INDEX.md", "md", extractMarkdown("- `Registro.xlsx`, aba `Atividades`: fonte das atividades."));
    addSource(db, "a", "Registro.xlsm", "xlsx", sheet("Atividades"));
    addSource(db, "b", "Registro.xls", "xlsx", sheet("Atividades"));
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ status: "pending", problem: "file_not_found" });
    db.run("DELETE FROM sources WHERE file_id IN ('a', 'b')");
    addSource(db, "c", "Outra coisa.xlsm", "xlsx", sheet("Atividades"));
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ status: "pending", problem: "file_not_found" });
  });

  it("se o arquivo exato existe, ele vence (o nome-base só é plano B)", () => {
    const db = testDb();
    setSetting(db, SETTING.rootFolder, { id: "root", name: "P", url: null }, NOW);
    addSource(db, "i", "INDEX.md", "md", extractMarkdown("- `Registro.xlsx`, aba `Atividades`: fonte das atividades."));
    addSource(db, "x", "Registro.xlsx", "xlsx", sheet("Atividades"));
    addSource(db, "m", "Registro.xlsm", "xlsx", sheet("Atividades"));
    expect(resolveRegistry(db, "INDEX.md")).toMatchObject({ status: "ok", source: { file_id: "x" } });
  });
});
