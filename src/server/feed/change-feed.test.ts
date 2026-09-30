import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { findMember, loadMembers } from "@/server/persona/members";
import { testDb } from "../../../tests/helpers/db";
import { documents, forPersona } from "./change-feed";

const members = loadMembers();
const ana = findMember(members, "ana")!;
const davi = findMember(members, "davi")!;
const carla = findMember(members, "carla")!;

const T0 = "2026-09-30T10:00:00.000Z"; // carga inicial
const SINCE = "2026-10-01T10:00:00.000Z";
const AFTER = "2026-10-02T10:00:00.000Z";
const TODAY = "2026-10-02";

function source(db: Db, id: string, name: string, extra: { first?: string; status?: string; removed?: string | null } = {}) {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, web_url, parent_id, path, sync_status, first_seen_at, last_seen_at, removed_at)
     VALUES (?, ?, 'x', 'md', ?, 'root', ?, ?, ?, ?, ?)`,
    id,
    name,
    `https://drive.example/${id}`,
    name,
    extra.status ?? "processed",
    extra.first ?? T0,
    extra.first ?? T0,
    extra.removed ?? null,
  );
}

function activity(db: Db, id: string, owners: string[], extra: { status?: string; due?: string | null; title?: string } = {}) {
  db.run(
    `INSERT INTO activities (id, title, front, status, due_date, next_step, origin, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, 'Growth', ?, ?, 'Passo', 'importada', ?, 'system:import', ?, 'system:import')`,
    id,
    extra.title ?? `Título ${id}`,
    extra.status ?? "em_andamento",
    extra.due === undefined ? "2026-12-01" : extra.due,
    T0,
    T0,
  );
  for (const o of owners) db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES (?, ?, ?)", id, o, o);
  db.run(
    "INSERT INTO activity_references (activity_id, file_id, source_version, relation, created_at) VALUES (?, 'sheet', 'h', 'imported_from', ?)",
    id,
    T0,
  );
}

function suggestion(
  db: Db,
  input: { id: number; kind: "create" | "update"; target: string | null; file?: string; fields: Array<[string, unknown, unknown, number?]>; stale?: boolean; createdAt?: string; uncertainties?: string[] },
) {
  db.run(
    `INSERT INTO suggestions (id, origin, kind, target_activity_id, source_file_id, source_version, doc_date, uncertainties_json, stale_since, dedupe_key, created_at)
     VALUES (?, 'ai', ?, ?, ?, 'v1', '2026-10-03', ?, ?, ?, ?)`,
    input.id,
    input.kind,
    input.target,
    input.file ?? "ata",
    JSON.stringify(input.uncertainties ?? []),
    input.stale ? AFTER : null,
    `k${input.id}`,
    input.createdAt ?? AFTER,
  );
  for (const [field, current, proposed, uncertain] of input.fields) {
    db.run(
      "INSERT INTO suggestion_fields (suggestion_id, field, current_value_json, proposed_value_json, uncertain) VALUES (?, ?, ?, ?, ?)",
      input.id,
      field,
      JSON.stringify(current),
      JSON.stringify(proposed),
      uncertain ?? 0,
    );
  }
}

function event(db: Db, activityId: string, kind: string, changes: unknown[], at = AFTER, file: string | null = "ata") {
  db.run(
    `INSERT INTO activity_events (activity_id, actor_id, occurred_at, kind, changes_json, reason, source_file_id, source_version)
     VALUES (?, 'bruno', ?, ?, ?, NULL, ?, 'v1')`,
    activityId,
    at,
    kind,
    JSON.stringify(changes),
    file,
  );
}

function seed() {
  const db = testDb();
  source(db, "sheet", "Registro.xlsx");
  source(db, "ata", "Ata_2026-10-03.md");
  activity(db, "ACT-101", ["ana"], { title: "Carrossel" });
  activity(db, "ACT-102", ["davi"], { title: "Checklist" });
  return db;
}

describe("ChangeFeed.forPersona", () => {
  it("CA-F9.1: Ana vê a proposta de prazo pendente, com a fonte; Davi não vê a de ACT-101", () => {
    const db = seed();
    suggestion(db, { id: 1, kind: "update", target: "ACT-101", fields: [["due_date", "2026-10-05", "2026-10-08"]] });
    const a = forPersona(db, members, ana, SINCE, TODAY);
    expect(a.pending).toHaveLength(1);
    expect(a.pending[0]).toMatchObject({
      suggestionId: 1,
      isNew: true,
      activity: { id: "ACT-101", title: "Carrossel" },
      source: { name: "Ata_2026-10-03.md", webUrl: "https://drive.example/ata" },
    });
    expect(a.pending[0].fields[0]).toEqual({ label: "Prazo", current: "05/10/2026", proposed: "08/10/2026", uncertain: false });
    expect(forPersona(db, members, davi, SINCE, TODAY).pending).toHaveLength(0);
  });

  it("CA-F9.2: depois do aceite, a mudança vira confirmada, com autor, data e as duas fontes; sai de pendentes", () => {
    const db = seed();
    db.run("UPDATE activities SET due_date = '2026-10-08' WHERE id = 'ACT-101'");
    event(db, "ACT-101", "suggestion_applied", [{ field: "dueDate", before: "2026-10-05", after: "2026-10-08" }]);
    const a = forPersona(db, members, ana, SINCE, TODAY);
    expect(a.pending).toHaveLength(0);
    expect(a.confirmed).toHaveLength(1);
    expect(a.confirmed[0]).toMatchObject({ actor: "Bruno", occurredAt: AFTER, kind: "suggestion_applied" });
    expect(a.confirmed[0].changes).toEqual([{ label: "Prazo", before: "05/10/2026", after: "08/10/2026" }]);
    expect(a.confirmed[0].sources.map((s) => s.name)).toEqual(["Ata_2026-10-03.md", "Registro.xlsx"]);
    expect(forPersona(db, members, davi, SINCE, TODAY).confirmed).toHaveLength(0);
  });

  it("a carga inicial (evento imported) e eventos antes do marco não contam como mudança", () => {
    const db = seed();
    event(db, "ACT-101", "imported", [], AFTER, null);
    event(db, "ACT-101", "updated", [{ field: "title", before: "a", after: "b" }], "2026-09-30T12:00:00.000Z", null);
    expect(forPersona(db, members, ana, SINCE, TODAY).confirmed).toHaveLength(0);
  });

  it("quem saiu da atividade ainda vê a mudança de responsável", () => {
    const db = seed();
    db.run("DELETE FROM activity_owners WHERE activity_id = 'ACT-101' AND member_id = 'ana'");
    db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES ('ACT-101', 'davi', 'Davi')");
    event(db, "ACT-101", "updated", [{ field: "ownerIds", before: ["ana"], after: ["davi"] }], AFTER, null);
    const a = forPersona(db, members, ana, SINCE, TODAY);
    expect(a.confirmed).toHaveLength(1);
    expect(a.confirmed[0].changes[0]).toEqual({ label: "Responsáveis", before: "Ana", after: "Davi" });
  });

  it("CA-F9.4: criação pendente com frente incerta aparece para Carla, marcada como incerta", () => {
    const db = seed();
    suggestion(db, {
      id: 2,
      kind: "create",
      target: null,
      fields: [
        ["title", null, "Organizar oficina"],
        ["owners", null, ["carla"]],
        ["front", null, "Formação", 1],
      ],
      uncertainties: ["A frente não está explícita na ata."],
    });
    const c = forPersona(db, members, carla, SINCE, TODAY);
    expect(c.pending).toHaveLength(1);
    expect(c.pending[0]).toMatchObject({ kind: "create", activity: null, uncertainties: ["A frente não está explícita na ata."] });
    expect(c.pending[0].fields.find((f) => f.label === "Frente")).toMatchObject({ proposed: "Formação", uncertain: true });
    expect(forPersona(db, members, ana, SINCE, TODAY).pending).toHaveLength(0);
  });

  it("CA-F9.3: persona sem nada aparece como vazia; nenhum campo é inventado", () => {
    const db = seed();
    const feed = forPersona(db, members, carla, SINCE, TODAY);
    expect(feed).toEqual({ confirmed: [], pending: [], uncertain: [], attention: [], empty: true });
  });

  it("bloqueadas, vencidas e próximas do vencimento entram em atenção; concluídas e distantes não", () => {
    const db = seed();
    activity(db, "ACT-201", ["carla"], { status: "bloqueada", due: null });
    activity(db, "ACT-202", ["carla"], { due: "2026-10-01" });
    activity(db, "ACT-203", ["carla"], { due: "2026-10-04" });
    activity(db, "ACT-204", ["carla"], { due: "2026-10-01", status: "concluida" });
    activity(db, "ACT-205", ["carla"], { due: "2026-12-20" });
    const att = forPersona(db, members, carla, SINCE, TODAY).attention;
    expect(att.map((a) => [a.activityId, a.reason])).toEqual([
      ["ACT-201", "bloqueada"],
      ["ACT-202", "vencida"],
      ["ACT-203", "vence_em_breve"],
    ]);
    expect(att[0].dueDate).toBeNull();
  });

  it("proposta desatualizada e duas propostas divergentes viram item incerto, com a fonte", () => {
    const db = seed();
    source(db, "ata2", "Ata_2026-10-04.md");
    suggestion(db, { id: 3, kind: "update", target: "ACT-101", fields: [["due_date", "2026-10-05", "2026-10-08"]] });
    suggestion(db, { id: 4, kind: "update", target: "ACT-101", file: "ata2", fields: [["due_date", "2026-10-05", "2026-10-09"]] });
    const conflict = forPersona(db, members, ana, SINCE, TODAY).uncertain.filter((u) => u.key.startsWith("conflict"));
    expect(conflict).toHaveLength(1);
    expect(conflict[0].text).toContain("08/10/2026 ou 09/10/2026");
    expect(conflict[0].sources.map((s) => s.name)).toEqual(["Ata_2026-10-03.md", "Ata_2026-10-04.md"]);

    db.run("UPDATE suggestions SET stale_since = ? WHERE id = 3", AFTER);
    const stale = forPersona(db, members, ana, SINCE, TODAY).uncertain.filter((u) => u.key.startsWith("stale"));
    expect(stale).toHaveLength(1);
  });

  it("fonte indisponível e estado a confirmar aparecem como incertos", () => {
    const db = seed();
    db.run("UPDATE sources SET sync_status = 'unavailable', removed_at = ? WHERE file_id = 'sheet'", AFTER);
    db.run("UPDATE activities SET status = NULL WHERE id = 'ACT-101'");
    const keys = forPersona(db, members, ana, SINCE, TODAY).uncertain.map((u) => u.key);
    expect(keys).toEqual(["status-ACT-101", "gone-ACT-101"]);
  });

  it("sugestão criada antes do marco não leva o selo de nova", () => {
    const db = seed();
    suggestion(db, { id: 5, kind: "update", target: "ACT-101", fields: [["status", "em_andamento", "concluida"]], createdAt: "2026-09-30T11:00:00.000Z" });
    expect(forPersona(db, members, ana, SINCE, TODAY).pending[0].isNew).toBe(false);
  });
});

describe("ChangeFeed.documents", () => {
  it("lista novos, alterados e indisponíveis desde o marco, com o resumo de IA só quando existe", () => {
    const db = testDb();
    source(db, "old", "Velho.md");
    source(db, "chg", "Alterado.md");
    source(db, "new", "Novo.md", { first: AFTER });
    source(db, "gone", "Sumiu.md", { status: "unavailable", removed: AFTER });
    source(db, "same", "Igual.md");
    db.run("INSERT INTO source_versions (file_id, content_hash, processed_at) VALUES ('chg', 'h1', ?)", T0);
    db.run("INSERT INTO source_versions (file_id, content_hash, processed_at) VALUES ('chg', 'h2', ?)", AFTER);
    db.run("INSERT INTO source_versions (file_id, content_hash, processed_at) VALUES ('same', 'h1', ?)", T0);
    db.run(
      `INSERT INTO document_analyses (file_id, content_hash, analyzer_version, purpose, status, document_summary, created_at)
       VALUES ('chg', 'h2', 'v1', 'extract', 'done', 'Prazo de ACT-101 mudou.', ?)`,
      AFTER,
    );
    const news = documents(db, SINCE);
    expect(news.map((n) => [n.name, n.kind])).toEqual([
      ["Alterado.md", "alterado"],
      ["Novo.md", "novo"],
      ["Sumiu.md", "indisponivel"],
    ].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")));
    expect(news.find((n) => n.name === "Alterado.md")?.aiSummary).toBe("Prazo de ACT-101 mudou.");
    expect(news.find((n) => n.name === "Novo.md")?.aiSummary).toBeNull();
    expect(news.find((n) => n.name === "Sumiu.md")?.aiSummary).toBeNull();
  });

  it("pastas e atalhos não entram", () => {
    const db = testDb();
    source(db, "f", "Pasta", { first: AFTER });
    db.run("UPDATE sources SET kind = 'folder' WHERE file_id = 'f'");
    expect(documents(db, SINCE)).toEqual([]);
  });
});
