import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/helpers/db";
import { getVisit, loadStartAt, recordVisit, resolveMarker } from "./visits";

const LOAD = "2026-09-30T10:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("marco temporal do resumo (DN-10)", () => {
  it("primeira visita usa o início da carga inicial", () => {
    const m = resolveMarker({ param: undefined, visit: undefined, loadStart: LOAD, now: at("2026-10-01T10:00:00.000Z") });
    expect(m).toMatchObject({ since: LOAD, kind: "carga" });
  });

  it("depois de um tempo, o marco é a última visita", () => {
    const visit = { last_visit_at: "2026-10-01T10:00:00.000Z", previous_visit_at: null };
    const m = resolveMarker({ param: undefined, visit, loadStart: LOAD, now: at("2026-10-01T15:00:00.000Z") });
    expect(m).toMatchObject({ since: "2026-10-01T10:00:00.000Z", kind: "visita" });
  });

  it("recarregar logo depois mantém o marco anterior (não zera o resumo)", () => {
    const visit = { last_visit_at: "2026-10-01T15:00:00.000Z", previous_visit_at: "2026-10-01T10:00:00.000Z" };
    const m = resolveMarker({ param: undefined, visit, loadStart: LOAD, now: at("2026-10-01T15:00:30.000Z") });
    expect(m.since).toBe("2026-10-01T10:00:00.000Z");
    const first = resolveMarker({ param: undefined, visit: { last_visit_at: "2026-10-01T15:00:00.000Z", previous_visit_at: null }, loadStart: LOAD, now: at("2026-10-01T15:00:30.000Z") });
    expect(first.since).toBe(LOAD);
  });

  it("período escolhido vence a visita; valor inválido é ignorado", () => {
    const now = at("2026-10-02T12:00:00.000Z");
    const visit = { last_visit_at: "2026-10-01T10:00:00.000Z", previous_visit_at: null };
    expect(resolveMarker({ param: "24h", visit, loadStart: LOAD, now }).since).toBe("2026-10-01T12:00:00.000Z");
    expect(resolveMarker({ param: "7d", visit, loadStart: LOAD, now }).since).toBe("2026-09-25T12:00:00.000Z");
    expect(resolveMarker({ param: "carga", visit, loadStart: LOAD, now }).since).toBe(LOAD);
    expect(resolveMarker({ param: "2026-10-01", visit, loadStart: LOAD, now }).since).toBe("2026-10-01T03:00:00.000Z");
    expect(resolveMarker({ param: "2026-13-45", visit, loadStart: LOAD, now }).since).toBe("2026-10-01T10:00:00.000Z");
    expect(resolveMarker({ param: "lixo'; DROP", visit, loadStart: LOAD, now }).kind).toBe("visita");
  });
});

describe("recordVisit", () => {
  it("guarda a visita e só desloca o marco anterior depois da janela de mesma visita", () => {
    const db = testDb();
    recordVisit(db, "ana", at("2026-10-01T10:00:00.000Z"));
    expect(getVisit(db, "ana")).toEqual({ last_visit_at: "2026-10-01T10:00:00.000Z", previous_visit_at: null });
    recordVisit(db, "ana", at("2026-10-01T10:00:40.000Z"));
    expect(getVisit(db, "ana")).toEqual({ last_visit_at: "2026-10-01T10:00:40.000Z", previous_visit_at: null });
    recordVisit(db, "ana", at("2026-10-01T16:00:00.000Z"));
    expect(getVisit(db, "ana")).toEqual({ last_visit_at: "2026-10-01T16:00:00.000Z", previous_visit_at: "2026-10-01T10:00:40.000Z" });
    expect(getVisit(db, "davi")).toBeUndefined();
  });

  it("loadStartAt usa a primeira sincronização, depois a primeira fonte, depois o reserva", () => {
    const db = testDb();
    expect(loadStartAt(db, "fallback")).toBe("fallback");
    db.run(
      `INSERT INTO sources (file_id, name, mime_type, kind, parent_id, path, sync_status, first_seen_at, last_seen_at)
       VALUES ('a', 'a', 'x', 'md', 'root', 'a', 'processed', ?, ?)`,
      "2026-09-30T09:00:00.000Z",
      "2026-09-30T09:00:00.000Z",
    );
    expect(loadStartAt(db, "fallback")).toBe("2026-09-30T09:00:00.000Z");
    db.run("INSERT INTO sync_runs (trigger_kind, status, started_at) VALUES ('initial', 'success', ?)", LOAD);
    expect(loadStartAt(db, "fallback")).toBe(LOAD);
  });
});
