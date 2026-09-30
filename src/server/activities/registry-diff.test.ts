import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialLoadDrive } from "@/server/drive/fake-seed";
import { getContent, saveContent } from "@/server/db/repos/sources-repo";
import type { SheetExtract } from "@/server/extract/types";
import { loadMembers } from "@/server/persona/members";
import { runSync } from "@/server/sync/sync-service";
import { steppingClock, testDb } from "../../../tests/helpers/db";
import { getActivityView } from "./activity-queries";
import { diffRegistry } from "./registry-diff";
import { registryImportHook } from "./import-hook";

const members = loadMembers();

async function world() {
  const db = testDb();
  const { drive, ids } = createInitialLoadDrive(join(process.cwd(), "dados_ficticios"));
  const clock = steppingClock();
  await runSync({ db, gateway: drive, rootFolderId: drive.rootId, clock, afterSync: [registryImportHook("INDEX.md")] }, "initial");
  const fileId = ids["Ata_registro.xlsx"];
  /** Simula uma nova versão do registro no Drive (conteúdo novo, hash novo). */
  const publish = (edit: (sheet: SheetExtract["sheets"][number]) => void) => {
    const stored = getContent(db, fileId)!;
    const extracted = JSON.parse(JSON.stringify(stored.extracted)) as SheetExtract;
    edit(extracted.sheets[0]);
    const hash = `v2-${Math.random().toString(36).slice(2)}`;
    saveContent(db, fileId, hash, extracted, clock.now().toISOString());
    db.run("UPDATE sources SET processed_hash = ? WHERE file_id = ?", hash, fileId);
  };
  return { db, clock, publish };
}

const row = (sheet: SheetExtract["sheets"][number], id: string) => sheet.rows.find((r) => r.cells.ID.text === id)!;

describe("diffRegistry (DN-02, RN-11)", () => {
  it("sem versão nova não faz nada (a importação inicial já é a versão conhecida)", async () => {
    const w = await world();
    expect(diffRegistry(w.db, "INDEX.md", members, w.clock)).toMatchObject({ status: "none" });
    expect(w.db.get("SELECT 1 AS x FROM suggestions")).toBeUndefined();
  });

  it("prazo editado na planilha vira sugestão de update; o oficial não muda; repetir não duplica", async () => {
    const w = await world();
    w.publish((sheet) => {
      const cell = row(sheet, "ACT-101").cells.Prazo;
      cell.text = "2026-10-07";
      cell.date = "2026-10-07";
    });
    const result = diffRegistry(w.db, "INDEX.md", members, w.clock);
    expect(result).toMatchObject({ status: "compared", suggestions: 1 });
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-05");
    const s = w.db.get<{ origin: string; kind: string; target_activity_id: string; analysis_id: number | null }>("SELECT origin, kind, target_activity_id, analysis_id FROM suggestions");
    expect(s).toEqual({ origin: "registry_diff", kind: "update", target_activity_id: "ACT-101", analysis_id: null });
    const f = w.db.get<{ field: string; current_value_json: string; proposed_value_json: string }>("SELECT field, current_value_json, proposed_value_json FROM suggestion_fields");
    expect(f).toEqual({ field: "due_date", current_value_json: '"2026-10-05"', proposed_value_json: '"2026-10-07"' });
    expect(w.db.get<{ quote: string }>("SELECT quote FROM suggestion_evidence")?.quote).toMatch(/2026-10-07/);
    expect(diffRegistry(w.db, "INDEX.md", members, w.clock)).toMatchObject({ status: "none" });
    expect(w.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM suggestions")?.n).toBe(1);
  });

  it("linha removida vira aviso e nada é apagado (RN-11); linha nova vira sugestão de criação", async () => {
    const w = await world();
    w.publish((sheet) => {
      sheet.rows = sheet.rows.filter((r) => r.cells.ID.text !== "ACT-104");
      const base = JSON.parse(JSON.stringify(row(sheet, "ACT-102"))) as (typeof sheet.rows)[number];
      base.cells.ID.text = "ACT-105";
      base.cells.Atividade.text = "Organizar o lanche da oficina";
      base.rowNumber = 9;
      sheet.rows.push(base);
    });
    const result = diffRegistry(w.db, "INDEX.md", members, w.clock);
    if (result.status !== "compared") throw new Error("esperado compared");
    expect(result.warnings.map((x) => x.message)).toEqual([expect.stringMatching(/ACT-104 ausente.*nada foi removido/)]);
    expect(getActivityView(w.db, members, "ACT-104")).toBeDefined();
    expect(w.db.all<{ kind: string }>("SELECT kind FROM suggestions").map((s) => s.kind)).toEqual(["create"]);
  });

  it("registro esvaziado não apaga nada e avisa (CA-F4.1)", async () => {
    const w = await world();
    w.publish((sheet) => {
      sheet.rows = [];
    });
    const result = diffRegistry(w.db, "INDEX.md", members, w.clock);
    if (result.status !== "compared") throw new Error("esperado compared");
    expect(result.warnings[0].message).toMatch(/sem linhas/);
    expect(w.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM activities")?.n).toBe(4);
  });
});
