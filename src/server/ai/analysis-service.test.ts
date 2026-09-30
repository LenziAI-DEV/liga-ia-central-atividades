import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registryImportHook } from "@/server/activities/import-hook";
import { createInitialLoadDrive } from "@/server/drive/fake-seed";
import { runSync } from "@/server/sync/sync-service";
import { loadMembers } from "@/server/persona/members";
import { steppingClock, testDb } from "../../../tests/helpers/db";
import { fixtureText } from "../../../tests/helpers/fixtures";
import { enqueueAnalyses, processQueue, retryAnalysis, type AnalysisDeps } from "./analysis-service";
import { DisabledProvider } from "./disabled-provider";
import { AiError, type AiProvider } from "./provider";
import { fixtureProvider, RecordedProvider } from "./recorded-provider";

const DATA_DIR = join(process.cwd(), "dados_ficticios");
const members = loadMembers();

function setup() {
  const db = testDb();
  const { drive } = createInitialLoadDrive(DATA_DIR);
  const clock = steppingClock();
  const sync = (withImport = true) =>
    runSync({ db, gateway: drive, rootFolderId: drive.rootId, clock, afterSync: withImport ? [registryImportHook("INDEX.md")] : [] }, "scheduled");
  const deps = (provider: AiProvider): AnalysisDeps => ({ db, provider, members, clock, indexFileName: "INDEX.md", maxInputChars: 60_000 });
  const run = async (provider: AiProvider = fixtureProvider()) => {
    enqueueAnalyses(db, "INDEX.md", clock);
    return processQueue(deps(provider));
  };
  const add = (name: string, path: string) => drive.addFile({ name, content: fixtureText(path) });
  return { db, drive, clock, sync, run, add, deps };
}

const snapshot = (db: ReturnType<typeof testDb>) =>
  JSON.stringify([db.all("SELECT * FROM activities ORDER BY id"), db.all("SELECT * FROM activity_owners ORDER BY activity_id, rowid"), db.all("SELECT * FROM activity_events ORDER BY id")]);

const pending = (db: ReturnType<typeof testDb>) =>
  db.all<{ id: number; kind: string; target_activity_id: string | null; review_status: string; stale_since: string | null; superseded_by: number | null }>(
    "SELECT id, kind, target_activity_id, review_status, stale_since, superseded_by FROM suggestions ORDER BY id",
  );

describe("AnalysisService (respostas reais gravadas do modelo)", () => {
  it("espera o registro ser importado (waiting_registry) e depois analisa", async () => {
    const { db, sync, run } = setup();
    await sync(false);
    const waiting = await run();
    expect(waiting.waiting).toBeGreaterThan(0);
    expect(db.all("SELECT status FROM document_analyses").every((r) => (r as { status: string }).status === "waiting_registry")).toBe(true);
    await sync(true);
    const after = await run();
    expect(after.done).toBeGreaterThan(0);
    expect(db.get("SELECT 1 AS x FROM document_analyses WHERE status = 'waiting_registry'")).toBeUndefined();
  });

  it("CA-F7.1/F7.2 — uma sugestão de update de ACT-101 e uma de criação; oficial intacto; ideia vaga sem tarefa", async () => {
    const { db, sync, run, add } = setup();
    await sync();
    add("Ata_2026-10-03.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");
    add("Ata_2026-10-04.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-04.md");
    await sync();
    const before = snapshot(db);
    await run();
    expect(snapshot(db)).toBe(before);

    const rows = pending(db);
    expect(rows.map((r) => [r.kind, r.target_activity_id, r.review_status])).toEqual([
      ["update", "ACT-101", "pendente"],
      ["create", null, "pendente"],
    ]);
    const fields = db.all<{ field: string; current_value_json: string | null; proposed_value_json: string }>(
      "SELECT field, current_value_json, proposed_value_json FROM suggestion_fields WHERE suggestion_id = ? ORDER BY field",
      rows[0].id,
    );
    expect(fields.find((f) => f.field === "due_date")).toMatchObject({ current_value_json: '"2026-10-05"', proposed_value_json: '"2026-10-07"' });
    expect(db.get<{ locator: string; quote: string }>("SELECT locator, quote FROM suggestion_evidence WHERE suggestion_id = ?", rows[0].id)?.quote).toMatch(/2026-10-07/);
    const noAction = db.all<{ no_action_json: string }>("SELECT no_action_json FROM document_analyses WHERE no_action_json <> '[]'");
    expect(noAction.map((n) => n.no_action_json).join("|")).toMatch(/not[ií]cias|Série/i);
  });

  it("CA-F7.7 — reprocessar a mesma versão não duplica sugestão (nem por reexecução forçada)", async () => {
    const { db, sync, run, add, clock } = setup();
    await sync();
    add("Ata_2026-10-03.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");
    await sync();
    await run();
    expect(enqueueAnalyses(db, "INDEX.md", clock)).toBe(0);
    db.run("UPDATE document_analyses SET status = 'pending'");
    await run();
    expect(pending(db).filter((r) => r.review_status === "pendente")).toHaveLength(1);
    expect(db.get<{ n: number }>("SELECT COUNT(*) AS n FROM suggestion_evidence")?.n).toBe(1);
  });

  it("fonte editada: sugestão da versão antiga fica substituída pela da nova (v03)", async () => {
    const { db, sync, run, add, drive } = setup();
    await sync();
    const id = add("Ata_2026-10-03.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");
    await sync();
    await run();
    const [first] = pending(db);

    drive.editContent(id, `${fixtureText("02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md")}\nObservação extra da reunião.\n`);
    await sync();
    // Entre a edição e a nova análise, a antiga fica marcada como desatualizada.
    enqueueAnalyses(db, "INDEX.md", setup().clock);
    expect(pending(db)[0].stale_since).not.toBeNull();
    await run();
    const rows = pending(db);
    expect(rows.find((r) => r.id === first.id)).toMatchObject({ review_status: "substituida" });
    const fresh = rows.filter((r) => r.review_status === "pendente");
    expect(fresh).toHaveLength(1);
    expect(rows.find((r) => r.id === first.id)?.superseded_by).toBe(fresh[0].id);
  });

  it("IA fora do ar: tentativas com espera, falha final, fonte continua processada, 'Tentar novamente' funciona (F7.10)", async () => {
    const { db, sync, run, add, clock } = setup();
    await sync();
    const id = add("Ata_2026-10-03.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");
    await sync();
    const down = new RecordedProvider(() => new AiError("unavailable", "fora do ar"));
    await run(down);
    const analysis = () => db.get<{ id: number; status: string; attempts: number; next_attempt_at: string | null }>("SELECT id, status, attempts, next_attempt_at FROM document_analyses WHERE file_id = ?", id)!;
    expect(analysis()).toMatchObject({ status: "pending", attempts: 1 });
    expect(analysis().next_attempt_at).not.toBeNull();
    // Antes da espera: não tenta de novo.
    const calls = down.calls.length;
    await run(down);
    expect(down.calls.length).toBe(calls);
    // Avança o relógio: nova tentativa.
    for (let i = 0; i < 400; i++) clock.now();
    await run(down);
    for (let i = 0; i < 400; i++) clock.now();
    await run(down);
    expect(analysis()).toMatchObject({ status: "failed", attempts: 3 });
    expect(db.get<{ sync_status: string }>("SELECT sync_status FROM sources WHERE file_id = ?", id)?.sync_status).toBe("processed");
    retryAnalysis(db, analysis().id);
    await run();
    expect(analysis().status).toBe("done");
    expect(pending(db).length).toBeGreaterThan(0);
  });

  it("sem IA (provedor desligado): análise 'disabled' e o resto segue; ao ligar, processa", async () => {
    const { db, sync, run, add } = setup();
    await sync();
    add("Ata_2026-10-03.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");
    await sync();
    const off = await run(new DisabledProvider("not_configured"));
    expect(off.disabled).toBeGreaterThan(0);
    expect(db.get("SELECT 1 AS x FROM suggestions")).toBeUndefined();
    const on = await run();
    expect(on.done).toBeGreaterThan(0);
    expect(pending(db)).toHaveLength(1);
  });

  it("ai_calls registra tokens e custo, sem conteúdo do documento", async () => {
    const { db, sync, run } = setup();
    await sync();
    await run();
    const call = db.get<Record<string, unknown>>("SELECT * FROM ai_calls ORDER BY id DESC LIMIT 1");
    expect(call).toBeDefined();
    expect(Object.keys(call!).sort()).toEqual(["cost_estimate_usd", "created_at", "error_code", "id", "input_tokens", "latency_ms", "model", "output_tokens", "purpose", "status"]);
  });

  it("documento acima do limite falha sem truncar", async () => {
    const { db, sync, add, clock, deps } = setup();
    await sync();
    const id = add("Ata_2026-10-03.md", "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");
    await sync();
    enqueueAnalyses(db, "INDEX.md", clock);
    await processQueue({ ...deps(fixtureProvider()), maxInputChars: 100 });
    expect(db.get<{ status: string; error_code: string }>("SELECT status, error_code FROM document_analyses WHERE file_id = ?", id)).toMatchObject({ status: "failed", error_code: "too_long" });
  });
});
