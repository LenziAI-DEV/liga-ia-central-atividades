import type { Clock } from "@/lib/datetime";
import type { Db } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { Member } from "@/server/persona/members";
import type { ActivityFields } from "./activity-input";

/** Ação de uma pessoa que já tinha aberto uma versão desatualizada da atividade. */
export class VersionConflictError extends AppError {
  constructor() {
    super(
      "version_conflict",
      "Esta atividade foi alterada por outra pessoa depois que você abriu a página. Abra-a de novo e refaça a mudança.",
    );
  }
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

interface Row {
  id: string;
  title: string;
  description: string | null;
  next_step: string | null;
  front: string | null;
  status: string | null;
  due_date: string | null;
  priority: string | null;
  notes: string | null;
  version: number;
}

const SCALARS = [
  ["title", "title"],
  ["description", "description"],
  ["nextStep", "next_step"],
  ["front", "front"],
  ["status", "status"],
  ["dueDate", "due_date"],
  ["priority", "priority"],
  ["notes", "notes"],
] as const satisfies ReadonlyArray<readonly [keyof ActivityFields, keyof Row]>;

function insertEvent(
  db: Db,
  activityId: string,
  actorId: string,
  at: string,
  kind: "created" | "updated",
  changes: FieldChange[],
  reason: string | null,
) {
  db.run(
    `INSERT INTO activity_events (activity_id, actor_id, occurred_at, kind, changes_json, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    activityId,
    actorId,
    at,
    kind,
    JSON.stringify(changes),
    reason,
  );
}

function addOwners(db: Db, activityId: string, ownerIds: readonly string[], members: readonly Member[]) {
  for (const memberId of ownerIds) {
    const name = members.find((m) => m.id === memberId)?.name ?? memberId;
    db.run("INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES (?, ?, ?)", activityId, memberId, name);
  }
}

function assertActor(actorId: string, members: readonly Member[]) {
  if (!members.some((m) => m.id === actorId)) {
    throw new AppError("unknown_actor", "Escolha uma persona antes de criar ou editar atividades.");
  }
}

/** Próximo ID `LIA-0001`, pulando qualquer ID já existente (mesmo importado em outra caixa). */
function nextId(db: Db): string {
  db.run("INSERT OR IGNORE INTO id_sequences (prefix, next_value) VALUES ('LIA', 1)");
  let n = db.get<{ next_value: number }>("SELECT next_value FROM id_sequences WHERE prefix = 'LIA'")!.next_value;
  let id = `LIA-${String(n).padStart(4, "0")}`;
  while (db.get("SELECT 1 AS present FROM activities WHERE id = ? COLLATE NOCASE", id)) {
    n++;
    id = `LIA-${String(n).padStart(4, "0")}`;
  }
  db.run("UPDATE id_sequences SET next_value = ? WHERE prefix = 'LIA'", n + 1);
  return id;
}

/** Cria uma atividade manual: ID novo, autor, horário e evento `created`, na mesma transação (F6.2, F6.5). */
export function createActivity(
  db: Db,
  fields: ActivityFields,
  actorId: string,
  members: readonly Member[],
  clock: Clock,
): { id: string } {
  assertActor(actorId, members);
  const now = clock.now().toISOString();
  return db.tx(() => {
    const id = nextId(db);
    db.run(
      `INSERT INTO activities (id, title, description, next_step, front, status, due_date, priority, notes, origin,
         created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`,
      id,
      fields.title,
      fields.description,
      fields.nextStep,
      fields.front,
      fields.status,
      fields.dueDate,
      fields.priority,
      fields.notes,
      now,
      actorId,
      now,
      actorId,
    );
    addOwners(db, id, fields.ownerIds, members);
    const changes: FieldChange[] = SCALARS.filter(([key]) => fields[key] !== null).map(([key]) => ({
      field: key,
      before: null,
      after: fields[key],
    }));
    if (fields.ownerIds.length > 0) changes.push({ field: "ownerIds", before: [], after: fields.ownerIds });
    insertEvent(db, id, actorId, now, "created", changes, null);
    return { id };
  });
}

/**
 * Edita campos com controle otimista (`expectedVersion`). Só grava e só gera evento se algo
 * mudou de fato; o evento traz antes → depois e o motivo opcional (F6.3, F6.5). Responsáveis
 * "a confirmar" (sem membro) são preservados: só a lista de membros é editável aqui.
 */
export function updateActivity(
  db: Db,
  id: string,
  patch: Partial<ActivityFields>,
  expectedVersion: number,
  actorId: string,
  members: readonly Member[],
  clock: Clock,
  reason?: string | null,
): { changed: boolean; version: number } {
  assertActor(actorId, members);
  const now = clock.now().toISOString();
  return db.tx(() => {
    const row = db.get<Row>("SELECT * FROM activities WHERE id = ? AND archived_at IS NULL", id);
    if (!row) throw new AppError("not_found", "Atividade não encontrada.");
    if (row.version !== expectedVersion) throw new VersionConflictError();

    const changes: FieldChange[] = [];
    const sets: string[] = [];
    const params: Array<string | number | null> = [];
    for (const [key, column] of SCALARS) {
      const after = patch[key];
      if (after === undefined || after === row[column]) continue;
      changes.push({ field: key, before: row[column], after });
      sets.push(`${column} = ?`);
      params.push(after);
    }

    let nextOwners: string[] | null = null;
    if (patch.ownerIds !== undefined) {
      const before = db
        .all<{ member_id: string }>("SELECT member_id FROM activity_owners WHERE activity_id = ? AND member_id IS NOT NULL", id)
        .map((o) => o.member_id);
      const same = before.length === patch.ownerIds.length && before.every((m) => patch.ownerIds!.includes(m));
      if (!same) {
        changes.push({ field: "ownerIds", before: [...before].sort(), after: [...patch.ownerIds].sort() });
        nextOwners = patch.ownerIds;
      }
    }
    if (changes.length === 0) return { changed: false, version: row.version };

    const result = db.run(
      `UPDATE activities SET ${[...sets, "updated_at = ?", "updated_by = ?", "version = version + 1"].join(", ")}
        WHERE id = ? AND version = ?`,
      ...params,
      now,
      actorId,
      id,
      expectedVersion,
    );
    if (result.changes !== 1) throw new VersionConflictError();
    if (nextOwners) {
      db.run("DELETE FROM activity_owners WHERE activity_id = ? AND member_id IS NOT NULL", id);
      addOwners(db, id, nextOwners, members);
    }
    insertEvent(db, id, actorId, now, "updated", changes, reason?.trim() || null);
    return { changed: true, version: row.version + 1 };
  });
}
