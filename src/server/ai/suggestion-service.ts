import type { Clock } from "@/lib/datetime";
import { parseActivityForm, type ActivityFields } from "@/server/activities/activity-input";
import { getActivityView } from "@/server/activities/activity-queries";
import { createActivity, updateActivity, VersionConflictError } from "@/server/activities/activity-service";
import type { Db } from "@/server/db/client";
import { getSource } from "@/server/db/repos/sources-repo";
import type { Member } from "@/server/persona/members";

export type ReviewAction = "accept" | "adjust" | "reject";

export type ReviewErrorCode =
  | "not_reviewer"
  | "already_reviewed"
  | "stale"
  | "value_changed"
  | "reason_required"
  | "invalid"
  | "not_found";

export type ReviewOutcome =
  | { ok: true; status: "aceita" | "ajustada" | "rejeitada"; activityId: string | null; changed: boolean }
  | { ok: false; code: ReviewErrorCode; message: string; errors?: Record<string, string> };

class ReviewError extends Error {
  constructor(
    readonly code: ReviewErrorCode,
    message: string,
    readonly errors?: Record<string, string>,
  ) {
    super(message);
  }
}

interface SuggestionRow {
  id: number;
  kind: "create" | "update";
  target_activity_id: string | null;
  source_file_id: string;
  source_version: string;
  review_status: string;
  stale_since: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
}

interface FieldRow {
  field: string;
  current_value_json: string | null;
  proposed_value_json: string;
  uncertain: number;
}

const TO_FORM: Record<string, keyof ActivityFields> = {
  title: "title",
  owners: "ownerIds",
  due_date: "dueDate",
  next_step: "nextStep",
  front: "front",
  status: "status",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function describeClosed(db: Db, row: SuggestionRow, members: readonly Member[]): ReviewError {
  if (row.review_status !== "pendente") {
    const who = members.find((m) => m.id === row.reviewer_id)?.name ?? row.reviewer_id ?? "o sistema";
    const when = row.reviewed_at ? ` em ${row.reviewed_at.slice(0, 10)}` : "";
    const label = row.review_status === "substituida" ? "substituída por uma nova versão da fonte" : `${row.review_status} por ${who}${when}`;
    return new ReviewError("already_reviewed", `Esta sugestão já foi ${label}. Nada foi alterado.`);
  }
  return new ReviewError("stale", "A fonte desta sugestão foi alterada. Aguarde a nova análise antes de decidir.");
}

/**
 * Revisão humana de uma sugestão (F8, ARCHITECTURE §6.6): aceitar, ajustar e aceitar, ou rejeitar
 * com motivo. Tudo numa transação: a sugestão é "reivindicada" por `UPDATE … WHERE pendente`, então
 * recarregar ou clicar de novo não repete nada (CA-F8.2); o valor oficial só muda se ainda for o que
 * a sugestão viu; o papel é checado aqui, no servidor, e não só na tela (CA-F8.4).
 */
export function reviewSuggestion(
  db: Db,
  input: { id: number; action: ReviewAction; reviewer: Member | null; adjusted?: Record<string, unknown>; reason?: string },
  members: readonly Member[],
  clock: Clock,
): ReviewOutcome {
  const { reviewer } = input;
  if (!reviewer || !reviewer.canReview) {
    const names = members.filter((m) => m.canReview).map((m) => m.name).join(" e ");
    return { ok: false, code: "not_reviewer", message: `Só revisores (${names}) podem decidir sobre sugestões.` };
  }
  const now = clock.now().toISOString();
  try {
    return db.tx((): ReviewOutcome => {
      const row = db.get<SuggestionRow>(
        `SELECT id, kind, target_activity_id, source_file_id, source_version, review_status, stale_since, reviewer_id, reviewed_at
           FROM suggestions WHERE id = ?`,
        input.id,
      );
      if (!row) throw new ReviewError("not_found", "Sugestão não encontrada.");
      // Já decidida ou desatualizada: responde isso antes de qualquer outra checagem.
      // Rejeitar uma sugestão desatualizada é permitido (descartar); aceitar ou ajustar, não.
      if (row.review_status !== "pendente" || (row.stale_since !== null && input.action !== "reject")) throw describeClosed(db, row, members);
      if (input.action !== "reject") {
        const current = getSource(db, row.source_file_id);
        if (!current || current.sync_status !== "processed" || current.processed_hash !== row.source_version) {
          throw new ReviewError("stale", "A fonte desta sugestão mudou ou não está mais disponível. Rejeite-a ou aguarde a nova análise.");
        }
      }

      const claim = (status: "aceita" | "ajustada" | "rejeitada", reason: string | null) => {
        const staleClause = status === "rejeitada" ? "" : " AND stale_since IS NULL";
        const r = db.run(
          `UPDATE suggestions SET review_status = ?, reviewer_id = ?, reviewed_at = ?, review_reason = ?
            WHERE id = ? AND review_status = 'pendente'${staleClause}`,
          status,
          reviewer.id,
          now,
          reason,
          row.id,
        );
        if (r.changes !== 1) {
          const fresh = db.get<SuggestionRow>("SELECT id, kind, target_activity_id, source_file_id, source_version, review_status, stale_since, reviewer_id, reviewed_at FROM suggestions WHERE id = ?", row.id)!;
          throw describeClosed(db, fresh, members);
        }
      };

      if (input.action === "reject") {
        const reason = (input.reason ?? "").trim();
        if (!reason) throw new ReviewError("reason_required", "Informe o motivo da rejeição.");
        claim("rejeitada", reason.slice(0, 2000));
        return { ok: true, status: "rejeitada", activityId: row.target_activity_id, changed: false };
      }

      const fields = db.all<FieldRow>(
        "SELECT field, current_value_json, proposed_value_json, uncertain FROM suggestion_fields WHERE suggestion_id = ?",
        row.id,
      );
      // Valor final de cada campo: o proposto, ou o ajustado pelo revisor (vazio = não aplicar).
      const finals = new Map<string, unknown>();
      const adjustedFields = new Set<string>();
      for (const f of fields) {
        const proposed = JSON.parse(f.proposed_value_json) as unknown;
        const formKey = TO_FORM[f.field];
        let final = proposed;
        if (input.action === "adjust" && input.adjusted && formKey in input.adjusted) {
          const raw = input.adjusted[formKey];
          final = formKey === "ownerIds" ? (Array.isArray(raw) ? raw : []) : typeof raw === "string" ? raw.trim() : raw;
          if (final === "" || (Array.isArray(final) && final.length === 0)) final = undefined;
        }
        if (!same(final, proposed)) adjustedFields.add(f.field);
        if (final !== undefined) finals.set(f.field, final);
      }

      const source = getSource(db, row.source_file_id);
      const evidence = db.get<{ locator: string; quote: string }>(
        "SELECT locator, quote FROM suggestion_evidence WHERE suggestion_id = ? ORDER BY id LIMIT 1",
        row.id,
      );
      const link = { suggestionId: row.id, sourceFileId: row.source_file_id, sourceVersion: row.source_version };
      const status = adjustedFields.size > 0 ? "ajustada" : "aceita";
      let activityId = row.target_activity_id;
      let changed = false;
      let eventId: number | null = null;

      if (row.kind === "update") {
        const activity = row.target_activity_id ? getActivityView(db, members, row.target_activity_id) : undefined;
        if (!activity) throw new ReviewError("invalid", "A atividade de destino não existe mais.");
        // O valor oficial precisa ser o que a sugestão viu (senão o revisor decidiria no escuro).
        const liveOwners = activity.owners.flatMap((o) => (o.memberId ? [o.memberId] : [])).sort();
        const live: Record<string, unknown> = {
          title: activity.title,
          owners: liveOwners,
          due_date: activity.dueDate,
          next_step: activity.nextStep,
          front: activity.front,
          status: activity.status,
        };
        for (const f of fields) {
          const seen = f.current_value_json === null ? null : (JSON.parse(f.current_value_json) as unknown);
          if (!same(seen, live[f.field] ?? null)) {
            throw new ReviewError("value_changed", `O valor de "${f.field}" mudou desde a sugestão. Revise a sugestão com o valor atual.`);
          }
        }
        // Valida o resultado (campos novos por cima do oficial) com as mesmas regras do formulário.
        const raw: Record<string, unknown> = {
          title: activity.title,
          description: activity.description,
          nextStep: activity.nextStep,
          front: activity.front,
          status: activity.status ?? "",
          dueDate: activity.dueDate,
          priority: activity.priority,
          notes: activity.notes,
        };
        let ownerIds = activity.owners.flatMap((o) => (o.memberId ? [o.memberId] : []));
        for (const [field, value] of finals) {
          const key = TO_FORM[field];
          if (key === "ownerIds") ownerIds = value as string[];
          else raw[key] = value;
        }
        const parsed = parseActivityForm(raw, members, ownerIds, {
          title: activity.title,
          description: activity.description,
          nextStep: activity.nextStep,
          front: activity.front,
          priority: activity.priority,
          notes: activity.notes,
        });
        if (!parsed.ok) throw new ReviewError("invalid", "Os valores ajustados são inválidos. Corrija os campos indicados.", parsed.errors as Record<string, string>);
        const patch: Partial<ActivityFields> = {};
        for (const [field] of finals) {
          const key = TO_FORM[field];
          (patch as Record<string, unknown>)[key] = parsed.value[key];
        }
        claim(status, null);
        const result = updateActivity(db, activity.id, patch, activity.version, reviewer.id, members, clock, `Sugestão #${row.id} ${status}`, link);
        changed = result.changed;
        eventId = result.eventId ?? null;
        if (changed) {
          db.run(
            `INSERT OR IGNORE INTO activity_references (activity_id, file_id, source_version, locator, quote_or_cell, relation, created_at)
             VALUES (?, ?, ?, ?, ?, 'updated_by', ?)`,
            activity.id,
            row.source_file_id,
            source?.drive_version ?? "",
            evidence?.locator ?? "",
            evidence?.quote.slice(0, 500) ?? null,
            now,
          );
        }
      } else {
        const raw: Record<string, unknown> = {};
        let ownerIds: string[] = [];
        for (const [field, value] of finals) {
          const key = TO_FORM[field];
          if (key === "ownerIds") ownerIds = value as string[];
          else raw[key] = value;
        }
        const parsed = parseActivityForm(raw, members, ownerIds);
        if (!parsed.ok) throw new ReviewError("invalid", "Os valores ajustados são inválidos. Corrija os campos indicados.", parsed.errors as Record<string, string>);
        claim(status, null);
        const created = createActivity(db, parsed.value, reviewer.id, members, clock, link);
        activityId = created.id;
        eventId = created.eventId;
        changed = true;
        db.run(
          `INSERT OR IGNORE INTO activity_references (activity_id, file_id, source_version, locator, quote_or_cell, relation, created_at)
           VALUES (?, ?, ?, ?, ?, 'created_by', ?)`,
          created.id,
          row.source_file_id,
          source?.drive_version ?? "",
          evidence?.locator ?? "",
          evidence?.quote.slice(0, 500) ?? null,
          now,
        );
        db.run("UPDATE suggestions SET created_activity_id = ? WHERE id = ?", created.id, row.id);
      }

      if (eventId !== null) db.run("UPDATE suggestions SET applied_event_id = ? WHERE id = ?", eventId, row.id);
      for (const f of fields) {
        db.run(
          "UPDATE suggestion_fields SET final_value_json = ?, adjusted_by_reviewer = ? WHERE suggestion_id = ? AND field = ?",
          finals.has(f.field) ? JSON.stringify(finals.get(f.field)) : null,
          adjustedFields.has(f.field) ? 1 : 0,
          row.id,
          f.field,
        );
      }
      return { ok: true, status, activityId, changed };
    });
  } catch (error) {
    if (error instanceof ReviewError) return { ok: false, code: error.code, message: error.message, errors: error.errors };
    if (error instanceof VersionConflictError) return { ok: false, code: "value_changed", message: error.safeMessage };
    throw error;
  }
}
