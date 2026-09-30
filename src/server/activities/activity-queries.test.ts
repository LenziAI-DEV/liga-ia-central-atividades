import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { loadMembers } from "@/server/persona/members";
import { testDb } from "../../../tests/helpers/db";
import { distinctFronts, filterActivities, listActivityViews, sortByDue } from "./activity-queries";

const NOW = "2026-09-30T10:00:00.000Z";
const TODAY = "2026-10-05";
const members = loadMembers();

function add(
  db: Db,
  id: string,
  o: { due?: string | null; status?: string | null; front?: string; owners?: Array<[string | null, string]> },
) {
  db.run(
    `INSERT INTO activities (id, title, front, status, due_date, origin, created_at, created_by, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, 'importada', ?, 'x', ?, 'x')`,
    id,
    `Título ${id}`,
    o.front ?? "Growth",
    o.status === undefined ? "a_fazer" : o.status,
    o.due === undefined ? null : o.due,
    NOW,
    NOW,
  );
  for (const [memberId, raw] of o.owners ?? []) {
    db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES (?, ?, ?)", id, memberId, raw);
  }
}

describe("consultas de atividades", () => {
  let db: Db;
  beforeEach(() => {
    db = testDb();
    db.run(
      `INSERT INTO sources (file_id, name, mime_type, kind, web_url, path, sync_status, first_seen_at, last_seen_at)
       VALUES ('f', 'Ata_registro.xlsx', 'x', 'xlsx', 'https://drive/x', 'Ata_registro.xlsx', 'processed', ?, ?)`,
      NOW,
      NOW,
    );
    add(db, "ACT-104", { due: "2026-10-11", front: "Operações", owners: [["ana", "Ana"], ["davi", "Davi"]] });
    add(db, "ACT-101", { due: "2026-10-05", status: "em_andamento", owners: [["ana", "Ana"]] });
    add(db, "ACT-103", { due: "2026-10-09", status: "bloqueada", front: "Formação", owners: [["carla", "Carla"]] });
    add(db, "ACT-102", { due: "2026-10-06", front: "Operações", owners: [["davi", "Davi"]] });
    add(db, "ACT-200", { due: null, status: null, owners: [[null, "Fulano"]] });
    add(db, "ACT-050", { due: "2026-10-01", status: "concluida", owners: [["ana", "Ana"]] });
    db.run(
      "INSERT INTO activity_references (activity_id, file_id, source_version, locator, relation, created_at) VALUES ('ACT-101', 'f', '1', 'Atividades!A2:J2', 'imported_from', ?)",
      NOW,
    );
  });

  const ids = (list: Array<{ id: string }>) => list.map((a) => a.id);

  it("uma atividade com dois responsáveis é uma só; nome desconhecido fica 'a confirmar'", () => {
    const all = listActivityViews(db, members);
    expect(all).toHaveLength(6);
    expect(all.find((a) => a.id === "ACT-104")?.owners.map((o) => o.name)).toEqual(["Ana", "Davi"]);
    expect(all.find((a) => a.id === "ACT-200")?.owners).toEqual([{ memberId: null, name: "Fulano" }]);
    expect(all.find((a) => a.id === "ACT-101")?.sources[0]).toMatchObject({ name: "Ata_registro.xlsx", webUrl: "https://drive/x" });
  });

  it("'minhas' = não concluídas em que a persona é responsável, inclusive compartilhadas (CA-F5.1)", () => {
    const all = listActivityViews(db, members);
    expect(ids(sortByDue(filterActivities(all, { ownerId: "ana", openOnly: true }, TODAY)))).toEqual(["ACT-101", "ACT-104"]);
    expect(ids(sortByDue(filterActivities(all, { ownerId: "davi", openOnly: true }, TODAY)))).toEqual(["ACT-102", "ACT-104"]);
    expect(ids(filterActivities(all, { ownerId: "carla", openOnly: true }, TODAY))).toEqual(["ACT-103"]);
    expect(ids(filterActivities(all, { ownerId: "bruno", openOnly: true }, TODAY))).toEqual([]);
  });

  it("ordena por prazo com 'a definir' por último", () => {
    const sorted = sortByDue(listActivityViews(db, members));
    expect(ids(sorted)).toEqual(["ACT-050", "ACT-101", "ACT-102", "ACT-103", "ACT-104", "ACT-200"]);
  });

  it("filtra por frente, estado e prazo", () => {
    const all = listActivityViews(db, members);
    expect(ids(sortByDue(filterActivities(all, { front: "Operações" }, TODAY)))).toEqual(["ACT-102", "ACT-104"]);
    expect(ids(filterActivities(all, { status: "bloqueada" }, TODAY))).toEqual(["ACT-103"]);
    expect(ids(filterActivities(all, { status: "a_confirmar" }, TODAY))).toEqual(["ACT-200"]);
    expect(ids(filterActivities(all, { due: "sem_prazo" }, TODAY))).toEqual(["ACT-200"]);
    expect(ids(sortByDue(filterActivities(all, { due: "vencido" }, TODAY)))).toEqual(["ACT-050"]);
    expect(ids(sortByDue(filterActivities(all, { due: "semana" }, TODAY)))).toEqual(["ACT-101", "ACT-102", "ACT-103", "ACT-104"]);
  });

  it("frentes distintas vêm dos dados", () => {
    expect(distinctFronts(listActivityViews(db, members))).toEqual(["Formação", "Growth", "Operações"]);
  });

  it("arquivadas não aparecem", () => {
    db.run("UPDATE activities SET archived_at = ? WHERE id = 'ACT-200'", NOW);
    expect(listActivityViews(db, members)).toHaveLength(5);
  });
});
