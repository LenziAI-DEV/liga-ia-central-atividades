import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registryImportHook } from "@/server/activities/import-hook";
import { getActivityView, listEvents } from "@/server/activities/activity-queries";
import { updateActivity } from "@/server/activities/activity-service";
import { createInitialLoadDrive } from "@/server/drive/fake-seed";
import { loadMembers, findMember } from "@/server/persona/members";
import { runSync } from "@/server/sync/sync-service";
import { steppingClock, testDb } from "../../../tests/helpers/db";
import { fixtureText } from "../../../tests/helpers/fixtures";
import { enqueueAnalyses, processQueue } from "./analysis-service";
import { fixtureProvider } from "./recorded-provider";
import { reviewSuggestion } from "./suggestion-service";

const members = loadMembers();
const who = (id: string) => findMember(members, id);

/** Carga inicial + Atas de 03 e 04/10 analisadas com as respostas reais gravadas. */
async function world() {
  const db = testDb();
  const { drive } = createInitialLoadDrive(join(process.cwd(), "dados_ficticios"));
  const clock = steppingClock();
  const sync = () => runSync({ db, gateway: drive, rootFolderId: drive.rootId, clock, afterSync: [registryImportHook("INDEX.md")] }, "scheduled");
  await sync();
  drive.addFile({ name: "Ata_2026-10-03.md", content: fixtureText("02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md") });
  drive.addFile({ name: "Ata_2026-10-04.md", content: fixtureText("02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-04.md") });
  await sync();
  enqueueAnalyses(db, "INDEX.md", clock);
  await processQueue({ db, provider: fixtureProvider(), members, clock, indexFileName: "INDEX.md", maxInputChars: 60_000 });
  const ids = db.all<{ id: number; kind: string }>("SELECT id, kind FROM suggestions ORDER BY id");
  return { db, clock, updateId: ids.find((s) => s.kind === "update")!.id, createId: ids.find((s) => s.kind === "create")!.id };
}

const review = (w: Awaited<ReturnType<typeof world>>, id: number, reviewer: string, action: "accept" | "adjust" | "reject", extra: { adjusted?: Record<string, unknown>; reason?: string } = {}) =>
  reviewSuggestion(w.db, { id, action, reviewer: who(reviewer) ?? null, ...extra }, members, w.clock);

describe("SuggestionService (revisão humana)", () => {
  it("CA-F8.1 — Bruno aceita: ACT-101 vai a 07/10, evento auditável com Bruno, fonte e duas referências", async () => {
    const w = await world();
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-05");
    const out = review(w, w.updateId, "bruno", "accept");
    expect(out).toMatchObject({ ok: true, status: "aceita", activityId: "ACT-101", changed: true });
    const activity = getActivityView(w.db, members, "ACT-101")!;
    expect(activity.dueDate).toBe("2026-10-07");
    expect(activity.owners.map((o) => o.name)).toEqual(["Ana"]);
    const [event] = listEvents(w.db, "ACT-101", members);
    expect(event).toMatchObject({ kind: "suggestion_applied", actor: "Bruno" });
    expect(event.changes).toEqual(expect.arrayContaining([{ field: "dueDate", before: "2026-10-05", after: "2026-10-07" }]));
    const ev = w.db.get<{ suggestion_id: number; source_file_id: string }>("SELECT suggestion_id, source_file_id FROM activity_events WHERE id = ?", event.id);
    expect(ev?.suggestion_id).toBe(w.updateId);
    expect(activity.sources.map((s) => s.relation)).toEqual(expect.arrayContaining(["imported_from", "updated_by"]));
    expect(w.db.get<{ review_status: string; reviewer_id: string }>("SELECT review_status, reviewer_id FROM suggestions WHERE id = ?", w.updateId)).toEqual({ review_status: "aceita", reviewer_id: "bruno" });
  });

  it("CA-F8.2 — aceitar de novo não repete nada: um único evento", async () => {
    const w = await world();
    review(w, w.updateId, "bruno", "accept");
    const again = review(w, w.updateId, "bruno", "accept");
    expect(again).toMatchObject({ ok: false, code: "already_reviewed" });
    const applied = listEvents(w.db, "ACT-101", members).filter((e) => e.kind === "suggestion_applied");
    expect(applied).toHaveLength(1);
  });

  it("CA-F8.4 — quem não é revisor (Ana, Davi, sem persona) não decide, e nada muda", async () => {
    const w = await world();
    for (const id of ["ana", "davi", null]) {
      const out = reviewSuggestion(w.db, { id: w.updateId, action: "accept", reviewer: id ? who(id)! : null }, members, w.clock);
      expect(out).toMatchObject({ ok: false, code: "not_reviewer" });
    }
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-05");
    expect(w.db.get<{ review_status: string }>("SELECT review_status FROM suggestions WHERE id = ?", w.updateId)?.review_status).toBe("pendente");
  });

  it("CA-F8.3 e F8.6 — Carla ajusta o próximo passo e aceita a criação: uma atividade nova, 'ajustada', com referência à ata", async () => {
    const w = await world();
    const out = review(w, w.createId, "carla", "adjust", { adjusted: { nextStep: "Escolher um problema real simples e testá-lo com a turma" } });
    expect(out).toMatchObject({ ok: true, status: "ajustada", changed: true });
    if (!out.ok || !out.activityId) throw new Error("esperado atividade");
    const created = getActivityView(w.db, members, out.activityId)!;
    expect(out.activityId).toMatch(/^LIA-\d{4}$/);
    expect(created).toMatchObject({ origin: "sugestao", dueDate: "2026-10-10", nextStep: "Escolher um problema real simples e testá-lo com a turma", createdBy: "carla" });
    expect(created.owners.map((o) => o.name)).toEqual(["Carla"]);
    expect(created.sources.map((s) => s.relation)).toContain("created_by");
    const fields = w.db.all<{ field: string; adjusted_by_reviewer: number }>("SELECT field, adjusted_by_reviewer FROM suggestion_fields WHERE suggestion_id = ? ORDER BY field", w.createId);
    expect(fields.filter((f) => f.adjusted_by_reviewer === 1).map((f) => f.field)).toEqual(["next_step"]);
    expect(w.db.get<number>("SELECT COUNT(*) AS n FROM activities WHERE origin = 'sugestao'")).toEqual({ n: 1 });
    // Recarregar e aceitar de novo não cria outra atividade (F8.5).
    expect(review(w, w.createId, "carla", "accept")).toMatchObject({ ok: false, code: "already_reviewed" });
    expect(w.db.get<number>("SELECT COUNT(*) AS n FROM activities WHERE origin = 'sugestao'")).toEqual({ n: 1 });
  });

  it("CA-F8.5 — rejeitar exige motivo; com motivo não altera a atividade", async () => {
    const w = await world();
    expect(review(w, w.updateId, "bruno", "reject")).toMatchObject({ ok: false, code: "reason_required" });
    expect(review(w, w.updateId, "bruno", "reject", { reason: "   " })).toMatchObject({ ok: false, code: "reason_required" });
    expect(review(w, w.updateId, "bruno", "reject", { reason: "Prazo ainda em discussão" })).toMatchObject({ ok: true, status: "rejeitada", changed: false });
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-05");
    expect(w.db.get<{ review_reason: string }>("SELECT review_reason FROM suggestions WHERE id = ?", w.updateId)?.review_reason).toBe("Prazo ainda em discussão");
  });

  it("valor oficial mudou depois da sugestão: recusa sem aplicar nada", async () => {
    const w = await world();
    const a = getActivityView(w.db, members, "ACT-101")!;
    updateActivity(w.db, "ACT-101", { dueDate: "2026-10-08" }, a.version, "ana", members, w.clock);
    const out = review(w, w.updateId, "bruno", "accept");
    expect(out).toMatchObject({ ok: false, code: "value_changed" });
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-08");
    expect(w.db.get<{ review_status: string }>("SELECT review_status FROM suggestions WHERE id = ?", w.updateId)?.review_status).toBe("pendente");
  });

  it("sugestão desatualizada (fonte editada) não pode ser decidida", async () => {
    const w = await world();
    w.db.run("UPDATE suggestions SET stale_since = ? WHERE id = ?", "2026-10-01T00:00:00.000Z", w.updateId);
    expect(review(w, w.updateId, "bruno", "accept")).toMatchObject({ ok: false, code: "stale" });
  });

  it("ajuste inválido (data impossível) é recusado com erro por campo e nada é gravado", async () => {
    const w = await world();
    const out = review(w, w.updateId, "bruno", "adjust", { adjusted: { dueDate: "2026-02-31" } });
    expect(out).toMatchObject({ ok: false, code: "invalid", errors: { dueDate: expect.any(String) } });
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-05");
    expect(w.db.get<{ review_status: string }>("SELECT review_status FROM suggestions WHERE id = ?", w.updateId)?.review_status).toBe("pendente");
  });

  it("ajustar o prazo para outra data é registrado como ajuste do revisor", async () => {
    const w = await world();
    const out = review(w, w.updateId, "bruno", "adjust", { adjusted: { dueDate: "2026-10-09" } });
    expect(out).toMatchObject({ ok: true, status: "ajustada" });
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-09");
    const f = w.db.get<{ proposed_value_json: string; final_value_json: string; adjusted_by_reviewer: number }>(
      "SELECT proposed_value_json, final_value_json, adjusted_by_reviewer FROM suggestion_fields WHERE suggestion_id = ? AND field = 'due_date'",
      w.updateId,
    );
    expect(f).toEqual({ proposed_value_json: '"2026-10-07"', final_value_json: '"2026-10-09"', adjusted_by_reviewer: 1 });
  });
});
