import type { Db } from "@/server/db/client";
import type { Member } from "@/server/persona/members";

export interface SuggestionFieldView {
  field: string;
  current: unknown;
  proposed: unknown;
  final: unknown;
  uncertain: boolean;
  adjusted: boolean;
}

export interface SuggestionEvidenceView {
  quote: string;
  locator: string;
  fileName: string;
  webUrl: string | null;
}

export interface SuggestionView {
  id: number;
  kind: "create" | "update";
  status: "pendente" | "aceita" | "ajustada" | "rejeitada" | "substituida";
  stale: boolean;
  target: { id: string; title: string; front: string | null } | null;
  sourceFileId: string;
  sourceName: string;
  sourceUrl: string | null;
  docDate: string | null;
  rationale: string | null;
  uncertainties: string[];
  fields: SuggestionFieldView[];
  evidence: SuggestionEvidenceView[];
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdActivityId: string | null;
}

interface Row {
  id: number;
  kind: "create" | "update";
  review_status: SuggestionView["status"];
  stale_since: string | null;
  target_activity_id: string | null;
  source_file_id: string;
  doc_date: string | null;
  rationale: string | null;
  uncertainties_json: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_activity_id: string | null;
}

const parse = (json: string | null): unknown => (json === null ? null : JSON.parse(json));

function toView(db: Db, members: readonly Member[], row: Row): SuggestionView {
  const source = db.get<{ name: string; web_url: string | null }>("SELECT name, web_url FROM sources WHERE file_id = ?", row.source_file_id);
  const target = row.target_activity_id
    ? db.get<{ id: string; title: string; front: string | null }>("SELECT id, title, front FROM activities WHERE id = ?", row.target_activity_id)
    : undefined;
  return {
    id: row.id,
    kind: row.kind,
    status: row.review_status,
    stale: row.stale_since !== null,
    target: target ?? null,
    sourceFileId: row.source_file_id,
    sourceName: source?.name ?? "(arquivo removido)",
    sourceUrl: source?.web_url ?? null,
    docDate: row.doc_date,
    rationale: row.rationale,
    uncertainties: JSON.parse(row.uncertainties_json) as string[],
    fields: db
      .all<{ field: string; current_value_json: string | null; proposed_value_json: string; final_value_json: string | null; uncertain: number; adjusted_by_reviewer: number }>(
        "SELECT field, current_value_json, proposed_value_json, final_value_json, uncertain, adjusted_by_reviewer FROM suggestion_fields WHERE suggestion_id = ? ORDER BY rowid",
        row.id,
      )
      .map((f) => ({
        field: f.field,
        current: parse(f.current_value_json),
        proposed: parse(f.proposed_value_json),
        final: parse(f.final_value_json),
        uncertain: f.uncertain === 1,
        adjusted: f.adjusted_by_reviewer === 1,
      })),
    evidence: db
      .all<{ quote: string; locator: string }>("SELECT quote, locator FROM suggestion_evidence WHERE suggestion_id = ? ORDER BY id", row.id)
      .map((e) => ({ quote: e.quote, locator: e.locator, fileName: source?.name ?? "(arquivo removido)", webUrl: source?.web_url ?? null })),
    reviewerName: row.reviewer_id ? (members.find((m) => m.id === row.reviewer_id)?.name ?? row.reviewer_id) : null,
    reviewedAt: row.reviewed_at,
    reviewReason: row.review_reason,
    createdActivityId: row.created_activity_id,
  };
}

const COLUMNS = `id, kind, review_status, stale_since, target_activity_id, source_file_id, doc_date, rationale, uncertainties_json,
                 reviewer_id, reviewed_at, review_reason, created_activity_id`;

export function listSuggestions(db: Db, members: readonly Member[], status?: "pendente" | "decididas"): SuggestionView[] {
  const where =
    status === "pendente" ? "WHERE review_status = 'pendente'" : status === "decididas" ? "WHERE review_status <> 'pendente'" : "";
  return db
    .all<Row>(`SELECT ${COLUMNS} FROM suggestions ${where} ORDER BY id DESC`)
    .map((row) => toView(db, members, row));
}

export function getSuggestion(db: Db, members: readonly Member[], id: number): SuggestionView | undefined {
  const row = db.get<Row>(`SELECT ${COLUMNS} FROM suggestions WHERE id = ?`, id);
  return row ? toView(db, members, row) : undefined;
}

export interface AnalysisView {
  id: number;
  fileId: string;
  fileName: string;
  fileUrl: string | null;
  status: string;
  attempts: number;
  errorMessage: string | null;
  summary: string | null;
  noAction: Array<{ reason: string; evidence: string }>;
  invalidCount: number;
  finishedAt: string | null;
}

/** Situação da análise por IA de cada documento: nada some sem rastro (F7.10, transparência). */
export function listAnalyses(db: Db): AnalysisView[] {
  return db
    .all<{
      id: number;
      file_id: string;
      status: string;
      attempts: number;
      error_message: string | null;
      document_summary: string | null;
      no_action_json: string;
      invalid_json: string;
      finished_at: string | null;
      name: string | null;
      web_url: string | null;
    }>(
      `SELECT a.id, a.file_id, a.status, a.attempts, a.error_message, a.document_summary, a.no_action_json, a.invalid_json, a.finished_at,
              s.name, s.web_url
         FROM document_analyses a LEFT JOIN sources s ON s.file_id = a.file_id
        WHERE a.purpose = 'extract' AND NOT (a.status = 'done' AND a.error_code = 'obsolete')
        ORDER BY a.id DESC`,
    )
    .map((a) => ({
      id: a.id,
      fileId: a.file_id,
      fileName: a.name ?? "(arquivo removido)",
      fileUrl: a.web_url,
      status: a.status,
      attempts: a.attempts,
      errorMessage: a.error_message,
      summary: a.document_summary,
      noAction: (JSON.parse(a.no_action_json) as Array<{ reason: string; evidence: string }>).map((n) => ({ reason: n.reason, evidence: n.evidence })),
      invalidCount: (JSON.parse(a.invalid_json) as unknown[]).length,
      finishedAt: a.finished_at,
    }));
}

/** Quantidade de sugestões pendentes por atividade, para o aviso "atualização pendente" (F4.7, nível 3). */
export function pendingByActivity(db: Db, activityId?: string): Map<string, number> {
  const rows = db.all<{ target_activity_id: string; n: number }>(
    `SELECT target_activity_id, COUNT(*) AS n FROM suggestions
      WHERE review_status = 'pendente' AND target_activity_id IS NOT NULL ${activityId ? "AND target_activity_id = ?" : ""}
      GROUP BY target_activity_id`,
    ...(activityId ? [activityId] : []),
  );
  return new Map(rows.map((r) => [r.target_activity_id, r.n]));
}

export interface PendingChangeView {
  suggestionId: number;
  field: string;
  value: unknown;
  sourceFileId: string;
  sourceName: string;
  sourceUrl: string | null;
}

/** Propostas pendentes (campo a campo) de uma atividade, com a fonte de cada uma. Base do conflito derivado (ADR-12). */
export function pendingChangesFor(db: Db, activityId: string): PendingChangeView[] {
  return db
    .all<{ id: number; field: string; proposed_value_json: string; source_file_id: string; name: string | null; web_url: string | null }>(
      `SELECT s.id, f.field, f.proposed_value_json, s.source_file_id, src.name, src.web_url
         FROM suggestions s
         JOIN suggestion_fields f ON f.suggestion_id = s.id
         LEFT JOIN sources src ON src.file_id = s.source_file_id
        WHERE s.review_status = 'pendente' AND s.stale_since IS NULL AND s.target_activity_id = ?
        ORDER BY s.id, f.rowid`,
      activityId,
    )
    .map((r) => ({
      suggestionId: r.id,
      field: r.field,
      value: JSON.parse(r.proposed_value_json) as unknown,
      sourceFileId: r.source_file_id,
      sourceName: r.name ?? "(arquivo removido)",
      sourceUrl: r.web_url,
    }));
}
