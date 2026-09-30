import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/lib/datetime";
import { openDb, type Db } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import { loadMembers } from "@/server/persona/members";
import { testDb } from "../../../tests/helpers/db";
import { parseActivityForm, type ActivityFields } from "./activity-input";
import { getActivityView, listEvents } from "./activity-queries";
import { createActivity, updateActivity, VersionConflictError } from "./activity-service";

const members = loadMembers();
const clock = fixedClock("2026-09-30T15:00:00.000Z");
const NOW = "2026-09-30T10:00:00.000Z";

const base: ActivityFields = {
  title: "Testar persistência",
  description: null,
  nextStep: null,
  front: "Operações",
  status: "a_fazer",
  dueDate: null,
  priority: null,
  notes: null,
  ownerIds: ["davi"],
};

function seedImported(db: Db) {
  db.run(
    `INSERT INTO activities (id, title, front, status, due_date, next_step, origin, created_at, created_by, updated_at, updated_by)
     VALUES ('ACT-102', 'Montar checklist', 'Operações', 'a_fazer', '2026-10-06', 'Revisar material', 'importada', ?, 'system:import', ?, 'system:import')`,
    NOW,
    NOW,
  );
  db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES ('ACT-102', 'davi', 'Davi')");
  db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES ('ACT-102', NULL, 'Fulano')");
}

describe("parseActivityForm", () => {
  it("título vazio gera erro em texto no campo e nada passa (CA-F6.3)", () => {
    const parsed = parseActivityForm({ title: "   " }, members, []);
    expect(parsed).toEqual({ ok: false, errors: { title: "Informe o título da atividade." } });
  });

  it("normaliza vazios, valida data, estado e responsáveis", () => {
    const ok = parseActivityForm({ title: " Algo ", dueDate: "", status: "em_andamento", front: " Growth " }, members, ["ana", "ana"]);
    expect(ok).toMatchObject({ ok: true, value: { title: "Algo", dueDate: null, status: "em_andamento", front: "Growth", ownerIds: ["ana"] } });
    const bad = parseActivityForm({ title: "x", dueDate: "2026-02-31", status: "feito" }, members, ["ninguem", "__proto__"]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["dueDate", "ownerIds", "status"]);
  });

  it("limita tamanhos", () => {
    const parsed = parseActivityForm({ title: "x".repeat(201) }, members, []);
    expect(parsed.ok).toBe(false);
  });
});

describe("ActivityService", () => {
  let db: Db;
  beforeEach(() => {
    db = testDb();
  });

  it("cria com ID LIA-0001, autor, horário, marca manual e evento created (CA-F6.1)", () => {
    const { id } = createActivity(db, base, "davi", members, clock);
    expect(id).toBe("LIA-0001");
    const view = getActivityView(db, members, id)!;
    expect(view).toMatchObject({ title: "Testar persistência", origin: "manual", dueDate: null, createdBy: "davi", version: 1 });
    expect(view.owners.map((o) => o.name)).toEqual(["Davi"]);
    const events = listEvents(db, id, members);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "created", actor: "Davi", occurredAt: "2026-09-30T15:00:00.000Z" });
    expect(createActivity(db, { ...base, title: "Outra" }, "davi", members, clock).id).toBe("LIA-0002");
  });

  it("pula IDs já existentes (mesmo em outra caixa)", () => {
    seedImported(db);
    db.run(
      `INSERT INTO activities (id, title, origin, created_at, created_by, updated_at, updated_by)
       VALUES ('lia-0001', 'Importada com ID parecido', 'importada', ?, 'x', ?, 'x')`,
      NOW,
      NOW,
    );
    expect(createActivity(db, base, "ana", members, clock).id).toBe("LIA-0002");
  });

  it("recusa autor que não é membro", () => {
    expect(() => createActivity(db, base, "ninguem", members, clock)).toThrow(/persona/);
    expect(() => createActivity(db, base, "system:import", members, clock)).toThrow(/persona/);
  });

  it("edição gera um evento com os campos antes → depois e o motivo (CA-F6.2)", () => {
    seedImported(db);
    const result = updateActivity(db, "ACT-102", { status: "em_andamento", nextStep: "Enviar versão 1" }, 1, "davi", members, clock, "avançou");
    expect(result).toMatchObject({ changed: true, version: 2 });
    const [event] = listEvents(db, "ACT-102", members);
    expect(event).toMatchObject({ kind: "updated", actor: "Davi", reason: "avançou" });
    expect(event.changes).toEqual([
      { field: "nextStep", before: "Revisar material", after: "Enviar versão 1" },
      { field: "status", before: "a_fazer", after: "em_andamento" },
    ]);
    expect(getActivityView(db, members, "ACT-102")).toMatchObject({ status: "em_andamento", version: 2, updatedBy: "davi" });
  });

  it("sem mudança real não grava nada nem gera evento", () => {
    seedImported(db);
    const result = updateActivity(db, "ACT-102", { title: "Montar checklist", status: "a_fazer", ownerIds: ["davi"] }, 1, "davi", members, clock);
    expect(result).toEqual({ changed: false, version: 1 });
    expect(listEvents(db, "ACT-102", members)).toHaveLength(0);
  });

  it("controle otimista: versão desatualizada é recusada sem gravar", () => {
    seedImported(db);
    updateActivity(db, "ACT-102", { status: "concluida" }, 1, "davi", members, clock);
    expect(() => updateActivity(db, "ACT-102", { status: "bloqueada" }, 1, "ana", members, clock)).toThrow(VersionConflictError);
    expect(getActivityView(db, members, "ACT-102")?.status).toBe("concluida");
    expect(listEvents(db, "ACT-102", members)).toHaveLength(1);
  });

  it("trocar responsáveis mantém os 'a confirmar' e registra o antes → depois", () => {
    seedImported(db);
    updateActivity(db, "ACT-102", { ownerIds: ["ana", "davi"] }, 1, "ana", members, clock);
    const view = getActivityView(db, members, "ACT-102")!;
    expect(view.owners.map((o) => o.name).sort()).toEqual(["Ana", "Davi", "Fulano"]);
    expect(listEvents(db, "ACT-102", members)[0].changes).toEqual([
      { field: "ownerIds", before: ["davi"], after: ["ana", "davi"] },
    ]);
  });

  it("atividade inexistente ou arquivada: erro claro", () => {
    expect(() => updateActivity(db, "NADA", { title: "x" }, 1, "ana", members, clock)).toThrow(/não encontrada/);
    seedImported(db);
    db.run("UPDATE activities SET archived_at = ? WHERE id = 'ACT-102'", NOW);
    expect(() => updateActivity(db, "ACT-102", { title: "x" }, 1, "ana", members, clock)).toThrow(/não encontrada/);
  });

  it("falha no meio da edição desfaz tudo (mesma transação)", () => {
    seedImported(db);
    db.run("DROP TRIGGER activity_events_no_update");
    db.run("CREATE TRIGGER boom BEFORE INSERT ON activity_events BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
    expect(() => updateActivity(db, "ACT-102", { status: "concluida" }, 1, "davi", members, clock)).toThrow(/falha simulada/);
    expect(getActivityView(db, members, "ACT-102")).toMatchObject({ status: "a_fazer", version: 1 });
  });

  it("persiste depois de fechar e reabrir o banco (v06, F6.4)", () => {
    const dir = mkdtempSync(join(tmpdir(), "lia-v06-"));
    const path = join(dir, "app.db");
    try {
      const first = openDb(path);
      migrate(first);
      const { id } = createActivity(first, base, "davi", members, clock);
      updateActivity(first, id, { status: "em_andamento" }, 1, "davi", members, clock);
      first.close();

      const second = openDb(path);
      migrate(second);
      expect(getActivityView(second, members, id)).toMatchObject({ status: "em_andamento", createdBy: "davi", version: 2 });
      expect(listEvents(second, id, members).map((e) => e.kind)).toEqual(["updated", "created"]);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("estado 'a confirmar' e campos importados (auditoria Fases 3–4)", () => {
  it("editar outro campo de uma atividade com estado a confirmar não decide o estado", () => {
    const db = testDb();
    seedImported(db);
    db.run("UPDATE activities SET status = NULL WHERE id = 'ACT-102'");
    const parsed = parseActivityForm(
      { title: "Título corrigido", status: "", front: "Operações", nextStep: "Revisar material", dueDate: "2026-10-06" },
      members,
      ["davi"],
    );
    if (!parsed.ok) throw new Error("esperado ok");
    expect(parsed.value.status).toBeNull();
    updateActivity(db, "ACT-102", parsed.value, 1, "davi", members, clock);
    expect(getActivityView(db, members, "ACT-102")?.status).toBeNull();
    const [event] = listEvents(db, "ACT-102", members);
    expect(event.changes.map((c) => c.field)).toEqual(["title"]);
  });

  it("escolher um estado para uma atividade 'a confirmar' é uma mudança registrada", () => {
    const db = testDb();
    seedImported(db);
    db.run("UPDATE activities SET status = NULL WHERE id = 'ACT-102'");
    updateActivity(db, "ACT-102", { status: "em_andamento" }, 1, "davi", members, clock);
    expect(listEvents(db, "ACT-102", members)[0].changes).toEqual([{ field: "status", before: null, after: "em_andamento" }]);
  });

  it("campo importado acima do limite continua editável se não for alterado", () => {
    const long = "x".repeat(300);
    expect(parseActivityForm({ title: long }, members, []).ok).toBe(false);
    expect(parseActivityForm({ title: long }, members, [], { title: long }).ok).toBe(true);
    expect(parseActivityForm({ title: long + "y" }, members, [], { title: long }).ok).toBe(false);
  });

  it("status ausente na criação vale 'a fazer'", () => {
    const parsed = parseActivityForm({ title: "x" }, members, []);
    expect(parsed).toMatchObject({ ok: true, value: { status: "a_fazer" } });
  });
});
