import { daysBetween, dueState } from "@/lib/datetime";
import type { Db } from "@/server/db/client";
import type { Member } from "@/server/persona/members";
import type { ActivityStatus } from "./field-maps";

export interface ActivityOwner {
  /** null = nome que não casou com nenhum membro ("a confirmar"). */
  memberId: string | null;
  name: string;
}

export interface ActivitySource {
  fileId: string;
  name: string;
  webUrl: string | null;
  relation: string;
  locator: string;
  /** Fonte removida, na lixeira ou sem acesso: a referência continua, marcada como indisponível (F3.4). */
  unavailableSince: string | null;
}

export interface ActivityView {
  id: string;
  title: string;
  description: string | null;
  front: string | null;
  /** null = estado a confirmar. */
  status: ActivityStatus | null;
  dueDate: string | null;
  nextStep: string | null;
  notes: string | null;
  priority: string | null;
  origin: string;
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  owners: ActivityOwner[];
  sources: ActivitySource[];
}

export type StatusFilter = ActivityStatus | "a_confirmar";
export type DueFilter = "vencido" | "semana" | "sem_prazo";

export interface ActivityFilter {
  /** Só atividades em que este membro é responsável (inclui as compartilhadas). */
  ownerId?: string;
  front?: string;
  status?: StatusFilter;
  due?: DueFilter;
  /** Esconde as concluídas ("Minhas atividades", F5.2). */
  openOnly?: boolean;
}

interface ActivityRow {
  id: string;
  title: string;
  description: string | null;
  version: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  front: string | null;
  status: ActivityStatus | null;
  due_date: string | null;
  next_step: string | null;
  notes: string | null;
  priority: string | null;
  origin: string;
}

/** Todas as atividades oficiais não arquivadas, com responsáveis e fontes. Só lê. */
export function listActivityViews(db: Db, members: readonly Member[], onlyId?: string): ActivityView[] {
  // Com `onlyId` (detalhe e edição) as três consultas ficam restritas a uma atividade.
  const scope = onlyId === undefined ? "" : " AND activity_id = ?";
  const args = onlyId === undefined ? [] : [onlyId];
  const names = new Map(members.map((m) => [m.id, m.name]));
  const owners = new Map<string, ActivityOwner[]>();
  for (const o of db.all<{ activity_id: string; member_id: string | null; raw_name: string }>(
    `SELECT activity_id, member_id, raw_name FROM activity_owners WHERE 1 = 1${scope} ORDER BY rowid`,
    ...args,
  )) {
    const list = owners.get(o.activity_id) ?? [];
    list.push({ memberId: o.member_id, name: (o.member_id && names.get(o.member_id)) || o.raw_name });
    owners.set(o.activity_id, list);
  }
  const sources = new Map<string, ActivitySource[]>();
  for (const r of db.all<{
    activity_id: string;
    file_id: string;
    name: string | null;
    web_url: string | null;
    relation: string;
    locator: string;
    sync_status: string | null;
    removed_at: string | null;
  }>(
    `SELECT r.activity_id, r.file_id, s.name, s.web_url, r.relation, r.locator, s.sync_status, s.removed_at
       FROM activity_references r LEFT JOIN sources s ON s.file_id = r.file_id
      WHERE 1 = 1${scope.replace("activity_id", "r.activity_id")}
      ORDER BY r.id`,
    ...args,
  )) {
    const list = sources.get(r.activity_id) ?? [];
    const gone = r.sync_status === "unavailable" || r.sync_status === "out_of_scope" || r.sync_status === null;
    list.push({
      fileId: r.file_id,
      name: r.name ?? "(arquivo removido)",
      webUrl: r.web_url,
      relation: r.relation,
      locator: r.locator,
      unavailableSince: gone ? (r.removed_at ?? "") : null,
    });
    sources.set(r.activity_id, list);
  }
  return db
    .all<ActivityRow>(
      `SELECT id, title, description, front, status, due_date, next_step, notes, priority, origin, version,
              created_at, created_by, updated_at, updated_by
         FROM activities WHERE archived_at IS NULL${onlyId === undefined ? "" : " AND id = ?"}`,
      ...args,
    )
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      front: a.front,
      status: a.status,
      dueDate: a.due_date,
      nextStep: a.next_step,
      notes: a.notes,
      priority: a.priority,
      origin: a.origin,
      version: a.version,
      createdAt: a.created_at,
      createdBy: a.created_by,
      updatedAt: a.updated_at,
      updatedBy: a.updated_by,
      owners: owners.get(a.id) ?? [],
      sources: sources.get(a.id) ?? [],
    }));
}

/** Por prazo (mais próximo primeiro), "a definir" por último; empate por ID. */
export function sortByDue(list: readonly ActivityView[]): ActivityView[] {
  return [...list].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.id.localeCompare(b.id, "pt-BR", { numeric: true });
  });
}

export function filterActivities(
  list: readonly ActivityView[],
  filter: ActivityFilter,
  today: string,
): ActivityView[] {
  return list.filter((a) => {
    if (filter.openOnly && a.status === "concluida") return false;
    if (filter.ownerId && !a.owners.some((o) => o.memberId === filter.ownerId)) return false;
    if (filter.front && a.front !== filter.front) return false;
    if (filter.status && (filter.status === "a_confirmar" ? a.status !== null : a.status !== filter.status)) return false;
    if (filter.due === "sem_prazo" && a.dueDate !== null) return false;
    if (filter.due === "vencido" && dueState(a.dueDate, today) !== "vencido") return false;
    if (filter.due === "semana") {
      if (a.dueDate === null) return false;
      const diff = daysBetween(today, a.dueDate);
      if (diff < 0 || diff > 7) return false;
    }
    return true;
  });
}

/** Frentes existentes nas atividades, para o filtro (sem inventar valores). */
export function distinctFronts(list: readonly ActivityView[]): string[] {
  return [...new Set(list.flatMap((a) => (a.front ? [a.front] : [])))].sort((x, y) => x.localeCompare(y, "pt-BR"));
}

export interface ActivityEvent {
  id: number;
  actor: string;
  occurredAt: string;
  kind: string;
  reason: string | null;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
}

/** Nome de quem agiu: membro, importação ou o id bruto (nunca some do histórico). */
export function actorName(actorId: string, members: readonly Member[]): string {
  if (actorId === "system:import") return "Importação do registro";
  return members.find((m) => m.id === actorId)?.name ?? actorId;
}

/** Histórico da atividade, do mais recente para o mais antigo (F6.1, F6.5). */
export function listEvents(db: Db, activityId: string, members: readonly Member[]): ActivityEvent[] {
  return db
    .all<{ id: number; actor_id: string; occurred_at: string; kind: string; reason: string | null; changes_json: string }>(
      "SELECT id, actor_id, occurred_at, kind, reason, changes_json FROM activity_events WHERE activity_id = ? ORDER BY id DESC",
      activityId,
    )
    .map((e) => ({
      id: e.id,
      actor: actorName(e.actor_id, members),
      occurredAt: e.occurred_at,
      kind: e.kind,
      reason: e.reason,
      changes: JSON.parse(e.changes_json) as ActivityEvent["changes"],
    }));
}

export function getActivityView(db: Db, members: readonly Member[], id: string): ActivityView | undefined {
  return listActivityViews(db, members, id)[0];
}
