import { dueState } from "@/lib/datetime";
import { formatFieldValue, SUGGESTION_FIELD_LABEL } from "@/lib/field-format";
import { listActivityViews, type ActivityView } from "@/server/activities/activity-queries";
import type { Db } from "@/server/db/client";
import type { Member } from "@/server/persona/members";

export interface FeedSource {
  fileId: string;
  name: string;
  webUrl: string | null;
  unavailable: boolean;
}

export interface FeedChange {
  label: string;
  before: string;
  after: string;
}

export interface ConfirmedItem {
  eventId: number;
  activityId: string;
  activityTitle: string;
  kind: string;
  actor: string;
  occurredAt: string;
  reason: string | null;
  changes: FeedChange[];
  /** A fonte do evento (ex.: a ata) e as referências da atividade (ex.: a planilha). */
  sources: FeedSource[];
}

export interface PendingField {
  label: string;
  current: string;
  proposed: string;
  uncertain: boolean;
}

export interface PendingItem {
  suggestionId: number;
  kind: "create" | "update";
  /** Criada depois do marco. */
  isNew: boolean;
  stale: boolean;
  activity: { id: string; title: string } | null;
  fields: PendingField[];
  uncertainties: string[];
  source: FeedSource;
  docDate: string | null;
}

export interface UncertainItem {
  key: string;
  text: string;
  activity: { id: string; title: string } | null;
  suggestionId: number | null;
  sources: FeedSource[];
}

export interface AttentionItem {
  activityId: string;
  title: string;
  reason: "bloqueada" | "vencida" | "vence_hoje" | "vence_em_breve";
  dueDate: string | null;
  nextStep: string | null;
}

export interface PersonalFeed {
  confirmed: ConfirmedItem[];
  pending: PendingItem[];
  uncertain: UncertainItem[];
  attention: AttentionItem[];
  /** Verdadeiro se nenhum dos quatro grupos tem item (CA-F9.3). */
  empty: boolean;
}

/** Nomes dos campos como o histórico os grava (camelCase) → chave do banco usada na formatação. */
const EVENT_FIELD_KEY: Record<string, string> = {
  title: "title",
  description: "description",
  nextStep: "next_step",
  front: "front",
  status: "status",
  dueDate: "due_date",
  ownerIds: "owners",
  priority: "priority",
  notes: "notes",
};
const EXTRA_LABEL: Record<string, string> = { priority: "Prioridade", notes: "Notas e bloqueios" };

function memberNameMap(members: readonly Member[]): ReadonlyMap<string, string> {
  return new Map(members.map((m) => [m.id, m.name]));
}

function actorLabel(actorId: string, members: readonly Member[]): string {
  if (actorId === "system:import") return "Importação do registro";
  return members.find((m) => m.id === actorId)?.name ?? actorId;
}

const parse = (json: string | null): unknown => (json === null ? null : JSON.parse(json));

class SourceCache {
  private readonly cache = new Map<string, FeedSource>();
  constructor(private readonly db: Db) {}
  get(fileId: string): FeedSource {
    const hit = this.cache.get(fileId);
    if (hit) return hit;
    const row = this.db.get<{ name: string; web_url: string | null; sync_status: string }>(
      "SELECT name, web_url, sync_status FROM sources WHERE file_id = ?",
      fileId,
    );
    const source: FeedSource = {
      fileId,
      name: row?.name ?? "(arquivo removido)",
      webUrl: row?.web_url ?? null,
      unavailable: !row || row.sync_status === "unavailable" || row.sync_status === "out_of_scope",
    };
    this.cache.set(fileId, source);
    return source;
  }
}

function formatChange(field: string, before: unknown, after: unknown, names: ReadonlyMap<string, string>): FeedChange {
  const key = EVENT_FIELD_KEY[field] ?? field;
  return {
    label: SUGGESTION_FIELD_LABEL[key] ?? EXTRA_LABEL[key] ?? field,
    before: formatFieldValue(key, before, names),
    after: formatFieldValue(key, after, names),
  };
}

interface EventRow {
  id: number;
  activity_id: string;
  actor_id: string;
  occurred_at: string;
  kind: string;
  changes_json: string;
  reason: string | null;
  source_file_id: string | null;
  title: string;
}

/** Eventos oficiais desde o marco em atividades em que a persona é (ou era) responsável. A carga inicial não conta como mudança. */
function confirmedFor(db: Db, members: readonly Member[], personaId: string, since: string, sources: SourceCache): ConfirmedItem[] {
  const names = memberNameMap(members);
  const rows = db.all<EventRow>(
    `SELECT e.id, e.activity_id, e.actor_id, e.occurred_at, e.kind, e.changes_json, e.reason, e.source_file_id, a.title
       FROM activity_events e JOIN activities a ON a.id = e.activity_id
      WHERE e.occurred_at > ? AND e.kind <> 'imported'
      ORDER BY e.id DESC`,
    since,
  );
  const owned = new Set(
    db.all<{ activity_id: string }>("SELECT activity_id FROM activity_owners WHERE member_id = ?", personaId).map((r) => r.activity_id),
  );
  const items: ConfirmedItem[] = [];
  for (const e of rows) {
    const changes = JSON.parse(e.changes_json) as Array<{ field: string; before: unknown; after: unknown }>;
    // Responsável antes ou depois da mudança: quem saiu da atividade também precisa saber.
    const ownerChange = changes.find((c) => c.field === "ownerIds");
    const wasOrIsOwner =
      owned.has(e.activity_id) ||
      (ownerChange !== undefined &&
        [ownerChange.before, ownerChange.after].some((v) => Array.isArray(v) && v.includes(personaId)));
    if (!wasOrIsOwner) continue;
    const refs = db.all<{ file_id: string }>(
      "SELECT DISTINCT file_id FROM activity_references WHERE activity_id = ? ORDER BY id",
      e.activity_id,
    );
    const fileIds = [...(e.source_file_id ? [e.source_file_id] : []), ...refs.map((r) => r.file_id)];
    items.push({
      eventId: e.id,
      activityId: e.activity_id,
      activityTitle: e.title,
      kind: e.kind,
      actor: actorLabel(e.actor_id, members),
      occurredAt: e.occurred_at,
      reason: e.reason,
      changes: changes.map((c) => formatChange(c.field, c.before, c.after, names)),
      sources: [...new Set(fileIds)].map((id) => sources.get(id)),
    });
  }
  return items;
}

interface SuggestionRow {
  id: number;
  kind: "create" | "update";
  target_activity_id: string | null;
  source_file_id: string;
  doc_date: string | null;
  stale_since: string | null;
  uncertainties_json: string;
  created_at: string;
}

function pendingFor(
  db: Db,
  members: readonly Member[],
  personaId: string,
  since: string,
  sources: SourceCache,
  titles: ReadonlyMap<string, string>,
): PendingItem[] {
  const names = memberNameMap(members);
  const rows = db.all<SuggestionRow>(
    `SELECT id, kind, target_activity_id, source_file_id, doc_date, stale_since, uncertainties_json, created_at
       FROM suggestions s
      WHERE review_status = 'pendente'
        AND (
          EXISTS (SELECT 1 FROM activity_owners o WHERE o.activity_id = s.target_activity_id AND o.member_id = ?)
          OR EXISTS (
            SELECT 1 FROM suggestion_fields f, json_each(f.proposed_value_json) j
             WHERE f.suggestion_id = s.id AND f.field = 'owners' AND j.value = ?
          )
        )
      ORDER BY id DESC`,
    personaId,
    personaId,
  );
  return rows.map((s) => {
    const fields = db
      .all<{ field: string; current_value_json: string | null; proposed_value_json: string; uncertain: number }>(
        "SELECT field, current_value_json, proposed_value_json, uncertain FROM suggestion_fields WHERE suggestion_id = ? ORDER BY rowid",
        s.id,
      )
      .map((f) => ({
        label: SUGGESTION_FIELD_LABEL[f.field] ?? f.field,
        current: formatFieldValue(f.field, parse(f.current_value_json), names),
        proposed: formatFieldValue(f.field, parse(f.proposed_value_json), names),
        uncertain: f.uncertain === 1,
      }));
    return {
      suggestionId: s.id,
      kind: s.kind,
      isNew: s.created_at > since,
      stale: s.stale_since !== null,
      activity: s.target_activity_id ? { id: s.target_activity_id, title: titles.get(s.target_activity_id) ?? s.target_activity_id } : null,
      fields,
      uncertainties: JSON.parse(s.uncertainties_json) as string[],
      source: sources.get(s.source_file_id),
      docDate: s.doc_date,
    };
  });
}

/** Incertezas e divergências que a persona precisa conhecer. Nada aqui é inventado: cada item cita a causa e a fonte. */
function uncertainFor(
  db: Db,
  members: readonly Member[],
  mine: readonly ActivityView[],
  pending: readonly PendingItem[],
  sources: SourceCache,
): UncertainItem[] {
  const names = memberNameMap(members);
  const items: UncertainItem[] = [];
  for (const p of pending) {
    if (p.stale) {
      items.push({
        key: `stale-${p.suggestionId}`,
        text: "Proposta desatualizada: o valor oficial mudou depois que ela foi feita. Revise antes de aceitar.",
        activity: p.activity,
        suggestionId: p.suggestionId,
        sources: [p.source],
      });
    }
  }
  for (const a of mine) {
    if (a.status === null) {
      items.push({
        key: `status-${a.id}`,
        text: "O estado desta atividade ainda está “a confirmar”.",
        activity: { id: a.id, title: a.title },
        suggestionId: null,
        sources: a.sources.map((s) => sources.get(s.fileId)),
      });
    }
    const gone = a.sources.filter((s) => s.unavailableSince !== null);
    if (gone.length > 0) {
      items.push({
        key: `gone-${a.id}`,
        text: "Uma fonte desta atividade está indisponível.",
        activity: { id: a.id, title: a.title },
        suggestionId: null,
        sources: gone.map((s) => sources.get(s.fileId)),
      });
    }
    // Duas propostas pendentes para o mesmo campo com valores diferentes.
    const byField = new Map<string, Array<{ id: number; value: string; fileId: string }>>();
    for (const row of db.all<{ id: number; field: string; proposed_value_json: string; source_file_id: string }>(
      `SELECT s.id, f.field, f.proposed_value_json, s.source_file_id
         FROM suggestions s JOIN suggestion_fields f ON f.suggestion_id = s.id
        WHERE s.review_status = 'pendente' AND s.stale_since IS NULL AND s.target_activity_id = ?`,
      a.id,
    )) {
      const list = byField.get(row.field) ?? [];
      list.push({ id: row.id, value: row.proposed_value_json, fileId: row.source_file_id });
      byField.set(row.field, list);
    }
    for (const [field, list] of byField) {
      if (new Set(list.map((l) => l.value)).size < 2) continue;
      items.push({
        key: `conflict-${a.id}-${field}`,
        text: `Há propostas diferentes para “${SUGGESTION_FIELD_LABEL[field] ?? field}”: ${list
          .map((l) => formatFieldValue(field, JSON.parse(l.value), names))
          .join(" ou ")}.`,
        activity: { id: a.id, title: a.title },
        suggestionId: list[0].id,
        sources: [...new Set(list.map((l) => l.fileId))].map((id) => sources.get(id)),
      });
    }
  }
  return items;
}

function attentionFor(mine: readonly ActivityView[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const a of mine) {
    if (a.status === "concluida") continue;
    const due = dueState(a.dueDate, today);
    const reason: AttentionItem["reason"] | null =
      a.status === "bloqueada" ? "bloqueada" : due === "vencido" ? "vencida" : due === "hoje" ? "vence_hoje" : due === "proximo" ? "vence_em_breve" : null;
    if (!reason) continue;
    items.push({ activityId: a.id, title: a.title, reason, dueDate: a.dueDate, nextStep: a.nextStep });
    // Bloqueada e também vencida: a causa mais urgente vem junto, num item só.
  }
  return items;
}

/** "O que mudou para mim" (F9): montado só por consulta aos registros, sem modelo (ADR-10, CA-F9.5). */
export function forPersona(db: Db, members: readonly Member[], persona: Member, since: string, today: string): PersonalFeed {
  const sources = new SourceCache(db);
  const views = listActivityViews(db, members);
  const titles = new Map(views.map((v) => [v.id, v.title]));
  const mine = views.filter((v) => v.owners.some((o) => o.memberId === persona.id));

  const confirmed = confirmedFor(db, members, persona.id, since, sources);
  const pending = pendingFor(db, members, persona.id, since, sources, titles);
  const uncertain = uncertainFor(db, members, mine, pending, sources);
  const attention = attentionFor(mine, today);
  return {
    confirmed,
    pending,
    uncertain,
    attention,
    empty: confirmed.length + pending.length + uncertain.length + attention.length === 0,
  };
}

export interface DocumentNews {
  fileId: string;
  name: string;
  webUrl: string | null;
  kind: "novo" | "alterado" | "indisponivel";
  at: string;
  reason: string | null;
  /** Resumo gerado pela IA na análise da versão. Sempre rotulado na tela. */
  aiSummary: string | null;
}

/** "Novidades dos documentos" (F9.7): novos, alterados e indisponíveis desde o marco. */
export function documents(db: Db, since: string): DocumentNews[] {
  const rows = db.all<{
    file_id: string;
    name: string;
    web_url: string | null;
    sync_status: string;
    status_reason: string | null;
    first_seen_at: string;
    removed_at: string | null;
    last_version_at: string | null;
  }>(
    `SELECT s.file_id, s.name, s.web_url, s.sync_status, s.status_reason, s.first_seen_at, s.removed_at,
            (SELECT MAX(v.processed_at) FROM source_versions v WHERE v.file_id = s.file_id) AS last_version_at
       FROM sources s
      WHERE s.kind NOT IN ('folder', 'shortcut')`,
  );
  const items: DocumentNews[] = [];
  for (const r of rows) {
    let kind: DocumentNews["kind"] | null = null;
    let at = "";
    if (r.removed_at !== null && r.removed_at > since) {
      kind = "indisponivel";
      at = r.removed_at;
    } else if (r.removed_at === null && r.first_seen_at > since) {
      kind = "novo";
      at = r.first_seen_at;
    } else if (r.removed_at === null && r.last_version_at !== null && r.last_version_at > since) {
      kind = "alterado";
      at = r.last_version_at;
    }
    if (!kind) continue;
    const analysis = db.get<{ document_summary: string | null }>(
      `SELECT document_summary FROM document_analyses
        WHERE file_id = ? AND purpose = 'extract' AND status = 'done' AND document_summary IS NOT NULL
        ORDER BY id DESC LIMIT 1`,
      r.file_id,
    );
    items.push({
      fileId: r.file_id,
      name: r.name,
      webUrl: r.web_url,
      kind,
      at,
      reason: kind === "indisponivel" ? r.status_reason : null,
      aiSummary: kind === "indisponivel" ? null : (analysis?.document_summary ?? null),
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.name.localeCompare(b.name, "pt-BR")));
}
