import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { steppingClock, testDb } from "../../../tests/helpers/db";
import type { Db } from "@/server/db/client";
import { SETTING, getSetting, type RootFolder } from "@/server/db/repos/settings-repo";
import { countVersions, getContent, getSource, listSources } from "@/server/db/repos/sources-repo";
import { acquireRun, lastFinishedRun } from "@/server/db/repos/sync-runs-repo";
import { createInitialLoadDrive } from "@/server/drive/fake-seed";
import { MIME } from "@/server/drive/gateway";
import { runSync } from "./sync-service";

const DATA_DIR = join(process.cwd(), "dados_ficticios");

function setup() {
  const db = testDb();
  const { drive, ids } = createInitialLoadDrive(DATA_DIR);
  const clock = steppingClock();
  const onAuthError = vi.fn();
  const sync = (trigger: "initial" | "scheduled" | "manual" = "scheduled") =>
    runSync({ db, gateway: drive, rootFolderId: drive.rootId, clock, onAuthError }, trigger);
  return { db, drive, ids, sync, onAuthError };
}

const files = (db: Db) => listSources(db).filter((s) => s.kind !== "folder");

describe("runSync — carga inicial (R02)", () => {
  it("processa os 6 arquivos, inclusive o da subpasta, com caminho e link (CA-F2.1)", async () => {
    const { db, sync } = setup();
    const outcome = await sync("initial");
    expect(outcome.status).toBe("success");
    expect(files(db).map((s) => [s.path, s.sync_status])).toEqual([
      ["Ata_registro.xlsx", "processed"],
      ["Atas/Ata_2026-10-01.md", "processed"],
      ["ESTADO-ATUAL.md", "processed"],
      ["GUIA_INICIAL.md", "processed"],
      ["INDEX.md", "processed"],
      ["PLANO_EDITORIAL_ANTIGO.md", "processed"],
    ]);
    expect(files(db).every((s) => s.web_url?.startsWith("https://"))).toBe(true);
    expect(outcome.counts).toMatchObject({ seen: 7, processed: 6, folders: 1, failed: 0, unsupported: 0 });
    expect(getSetting<RootFolder>(db, SETTING.rootFolder)?.name).toBe("LIA case teste");
  });

  it("guarda a data da reunião das atas e o conteúdo extraído", async () => {
    const { db, ids, sync } = setup();
    await sync("initial");
    expect(getSource(db, ids["Ata_2026-10-01.md"])?.doc_date).toBe("2026-10-01");
    const content = getContent(db, ids["Ata_registro.xlsx"]);
    expect(content?.extracted.kind).toBe("sheet");
  });

  it("formatos não suportados aparecem com motivo e sem conteúdo (CA-F2.2)", async () => {
    const { db, drive, sync } = setup();
    const png = drive.addFile({ name: "foto.png", content: "binário" });
    const docx = drive.addFile({ name: "Ata.docx", content: "binário" });
    await sync();
    expect(getSource(db, png)).toMatchObject({ sync_status: "unsupported", status_reason: expect.stringMatching(/imagem/) });
    expect(getSource(db, docx)).toMatchObject({ sync_status: "unsupported", status_reason: expect.stringMatching(/\.docx/) });
    expect(getContent(db, png)).toBeUndefined();
  });

  it("falha isolada: um arquivo com erro não impede os outros (CA-F2.3)", async () => {
    const { db, drive, ids, sync } = setup();
    drive.failNext("download", ids["INDEX.md"], "unknown");
    const outcome = await sync("initial");
    expect(outcome.status).toBe("partial");
    expect(outcome.counts).toMatchObject({ processed: 5, failed: 1 });
    expect(getSource(db, ids["INDEX.md"])).toMatchObject({ sync_status: "failed", status_reason: expect.any(String) });
    // Próximo ciclo tenta de novo.
    await sync();
    expect(getSource(db, ids["INDEX.md"])?.sync_status).toBe("processed");
  });

  it("arquivo corrompido falha com motivo — nunca vira 'vazio'", async () => {
    const { db, drive, sync } = setup();
    const bad = drive.addFile({ name: "quebrada.xlsx", content: "não é xlsx" });
    await sync();
    expect(getSource(db, bad)).toMatchObject({ sync_status: "failed", status_reason: expect.stringMatching(/inválido ou corrompido/) });
    expect(getContent(db, bad)).toBeUndefined();
  });
});

describe("runSync — incremental (R03)", () => {
  it("idempotente: um segundo ciclo sem mudanças não baixa nada (CA-F3.5)", async () => {
    const { db, drive, sync } = setup();
    await sync("initial");
    const downloads = drive.calls.download;
    const outcome = await sync();
    expect(drive.calls.download).toBe(downloads);
    expect(outcome.counts).toMatchObject({ processed: 0, unchanged: 6 });
    expect(files(db)).toHaveLength(6);
  });

  it("arquivo novo é detectado e processado sem upload pela interface (CA-F3.1)", async () => {
    const { db, drive, sync } = setup();
    await sync("initial");
    const ata = drive.addFile({ name: "Ata_2026-10-04.md", content: "# Ata\n\nstatus: ativo\ndata_da_reuniao: 2026-10-04\n\n## Nova decisão\n\nx" });
    const outcome = await sync();
    expect(outcome.counts.processed).toBe(1);
    expect(getSource(db, ata)).toMatchObject({ sync_status: "processed", doc_date: "2026-10-04" });
  });

  it("edição: nova versão, uma só fonte, histórico de versões (CA-F3.2)", async () => {
    const { db, drive, sync } = setup();
    const doc = drive.addFile({ name: "Ata_2026-10-03", mimeType: MIME.gdoc, content: "# Ata\n\nprazo 2026-10-07" });
    await sync();
    const firstHash = getSource(db, doc)?.processed_hash;
    drive.editContent(doc, "# Ata\n\nprazo 2026-10-08");
    const outcome = await sync();
    expect(outcome.counts.processed).toBe(1);
    expect(listSources(db).filter((s) => s.file_id === doc)).toHaveLength(1);
    expect(getSource(db, doc)?.processed_hash).not.toBe(firstHash);
    expect(countVersions(db, doc)).toBe(2);
  });

  it("renomear preserva a identidade e não reprocessa o conteúdo (CA-F3.3)", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.rename(ids["INDEX.md"], "INDICE.md");
    const outcome = await sync();
    expect(getSource(db, ids["INDEX.md"])).toMatchObject({ name: "INDICE.md", path: "INDICE.md", sync_status: "processed" });
    expect(outcome.counts.processed).toBe(0);
    expect(countVersions(db, ids["INDEX.md"])).toBe(1);
  });

  it("lixeira → indisponível, conteúdo em cache apagado (CA-F3.4)", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.trash(ids["GUIA_INICIAL.md"]);
    const outcome = await sync();
    expect(outcome.counts.unavailable).toBe(1);
    expect(getSource(db, ids["GUIA_INICIAL.md"])).toMatchObject({ sync_status: "unavailable", status_reason: expect.stringMatching(/lixeira/) });
    expect(getContent(db, ids["GUIA_INICIAL.md"])).toBeUndefined();
  });

  it("acesso revogado a um arquivo → indisponível (CA-F3.4)", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.revokeAccess(ids["ESTADO-ATUAL.md"]);
    await sync();
    expect(getSource(db, ids["ESTADO-ATUAL.md"])).toMatchObject({ sync_status: "unavailable", status_reason: expect.stringMatching(/sem acesso/) });
  });

  it("movido para fora da pasta → fora do escopo (F3.7)", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.moveOut(ids["PLANO_EDITORIAL_ANTIGO.md"]);
    await sync();
    expect(getSource(db, ids["PLANO_EDITORIAL_ANTIGO.md"])?.sync_status).toBe("out_of_scope");
  });

  it("subpasta na lixeira leva junto o que estava dentro", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.trash(ids.Atas);
    await sync();
    expect(getSource(db, ids["Ata_2026-10-01.md"])?.sync_status).toBe("unavailable");
  });

  it("arquivo que volta da lixeira é processado de novo", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.trash(ids["INDEX.md"]);
    await sync();
    drive.untrash(ids["INDEX.md"]);
    await sync();
    expect(getSource(db, ids["INDEX.md"])?.sync_status).toBe("processed");
    expect(getContent(db, ids["INDEX.md"])).toBeDefined();
  });
});

describe("runSync — falhas (CA-F1.3, CA-F3.6, AR-16)", () => {
  it("Drive fora do ar: ciclo falha e nada muda no banco", async () => {
    const { db, drive, sync } = setup();
    await sync("initial");
    const before = JSON.stringify(listSources(db));
    drive.setOffline(true);
    const outcome = await sync();
    expect(outcome).toMatchObject({ status: "failed", errorCode: "drive_unreachable" });
    expect(JSON.stringify(listSources(db))).toBe(before);
    expect(lastFinishedRun(db)?.status).toBe("failed");
  });

  it("autorização revogada: pede reautorização e não toca nas fontes", async () => {
    const { db, drive, sync, onAuthError } = setup();
    await sync("initial");
    const before = JSON.stringify(listSources(db));
    drive.revokeAll();
    const outcome = await sync();
    expect(outcome).toMatchObject({ status: "failed", errorCode: "auth" });
    expect(onAuthError).toHaveBeenCalledOnce();
    expect(JSON.stringify(listSources(db))).toBe(before);
  });

  it("listagem de subpasta falha: nada sob ela é dado como removido", async () => {
    const { db, drive, ids, sync } = setup();
    await sync("initial");
    drive.failNext("listChildren", ids.Atas, "transient");
    const outcome = await sync();
    expect(outcome.status).toBe("partial");
    expect(getSource(db, ids["Ata_2026-10-01.md"])?.sync_status).toBe("processed");
  });

  it("pasta raiz inexistente gera erro claro", async () => {
    const db = testDb();
    const { drive } = createInitialLoadDrive(DATA_DIR);
    const outcome = await runSync({ db, gateway: drive, rootFolderId: "nao-existe", clock: steppingClock() }, "manual");
    expect(outcome).toMatchObject({ status: "failed", errorCode: "root_not_found" });
  });

  it("execução única: não abre um segundo ciclo simultâneo", async () => {
    const { db, sync } = setup();
    acquireRun(db, "scheduled", new Date("2026-09-29T12:00:00Z"));
    expect((await sync()).status).toBe("already_running");
  });
});
