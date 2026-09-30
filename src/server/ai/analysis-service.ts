import type { Clock } from "@/lib/datetime";
import { listActivityViews, type ActivityView } from "@/server/activities/activity-queries";
import { classifySources } from "@/server/authority/classifier";
import type { Db } from "@/server/db/client";
import { getContent, getSource, listTrackedSources } from "@/server/db/repos/sources-repo";
import { logger } from "@/server/observability/logger";
import type { Member } from "@/server/persona/members";
import { ANALYZER_VERSION, buildExtractPrompt } from "./prompts/extract-v1";
import { AiError, type AiProvider } from "./provider";
import { validateExtraction, type ProposedFields, type ValidSuggestion, type ValidatorActivity } from "./validator";

export const MAX_ATTEMPTS = 3;

export interface AnalysisDeps {
  db: Db;
  provider: AiProvider;
  members: readonly Member[];
  clock: Clock;
  indexFileName: string;
  maxInputChars: number;
  effortLabel?: string;
  /** Só analisa quando a versão ficou estável por este tempo (evita custo a cada edição). 0 = sem espera. */
  debounceMs?: number;
  /** Teto de chamadas ao modelo nas últimas 24 h. Indefinido = sem teto. */
  dailyCallLimit?: number;
}

export interface QueueSummary {
  done: number;
  failed: number;
  retrying: number;
  waiting: number;
  disabled: number;
}

interface AnalysisRow {
  id: number;
  file_id: string;
  content_hash: string;
  attempts: number;
}

const globals = globalThis as unknown as { __liaAnalysisRunning?: boolean };

/** Nome do campo da sugestão → coluna/chave persistida. */
const FIELD_KEY: Record<keyof ProposedFields, string> = {
  title: "title",
  ownerIds: "owners",
  dueDate: "due_date",
  nextStep: "next_step",
  front: "front",
  status: "status",
};

/**
 * Coloca na fila a análise de cada ata na versão processada atual (idempotente: a chave é
 * arquivo + hash + versão do prompt, F7.9). Sugestões pendentes de versões antigas do arquivo
 * ficam marcadas como desatualizadas até a nova análise terminar (CA-F3.5).
 */
export function enqueueAnalyses(db: Db, indexFileName: string, clock: Clock): number {
  const now = clock.now().toISOString();
  const classes = classifySources(db, indexFileName);
  let queued = 0;
  const ataIds = new Set<string>();
  for (const source of listTrackedSources(db)) {
    if ((source.kind !== "md" && source.kind !== "gdoc") || source.sync_status !== "processed" || !source.processed_hash) continue;
    if (classes.get(source.file_id)?.class !== "ata") continue;
    ataIds.add(source.file_id);
    const result = db.run(
      `INSERT OR IGNORE INTO document_analyses (file_id, content_hash, analyzer_version, purpose, status, created_at)
       VALUES (?, ?, ?, 'extract', 'pending', ?)`,
      source.file_id,
      source.processed_hash,
      ANALYZER_VERSION,
      now,
    );
    queued += result.changes;
    db.run(
      `UPDATE suggestions SET stale_since = COALESCE(stale_since, ?)
        WHERE source_file_id = ? AND source_version <> ? AND review_status = 'pendente'`,
      now,
      source.file_id,
      source.processed_hash,
    );
  }
  // Sugestões de IA cuja fonte deixou de ser ata (ou sumiu) não podem mais ser aceitas.
  for (const r of db.all<{ id: string }>("SELECT DISTINCT source_file_id AS id FROM suggestions WHERE review_status = 'pendente' AND origin = 'ai'")) {
    if (!ataIds.has(r.id)) db.run("UPDATE suggestions SET stale_since = COALESCE(stale_since, ?) WHERE source_file_id = ? AND origin = 'ai' AND review_status = 'pendente'", now, r.id);
  }
  return queued;
}

/** "Tentar novamente" (F7.10): volta a análise para a fila com as tentativas zeradas. */
export function retryAnalysis(db: Db, analysisId: number) {
  db.run(
    `UPDATE document_analyses SET status = 'pending', attempts = 0, next_attempt_at = NULL, error_code = NULL, error_message = NULL
      WHERE id = ? AND status IN ('failed', 'disabled', 'pending', 'waiting_registry')`,
    analysisId,
  );
}

const registryImported = (db: Db) => db.get("SELECT 1 AS present FROM registry_imports WHERE kind = 'initial'") !== undefined;

function officialContext(db: Db, members: readonly Member[]) {
  const views = listActivityViews(db, members);
  const fronts = [...new Set([...members.map((m) => m.front), ...views.flatMap((v) => (v.front ? [v.front] : []))])];
  return {
    views,
    fronts,
    prompt: views.map((v) => ({
      id: v.id,
      title: v.title,
      owners: v.owners.map((o) => o.name),
      dueDate: v.dueDate,
      status: v.status,
      nextStep: v.nextStep,
      front: v.front,
    })),
    validator: views.map(
      (v: ActivityView): ValidatorActivity => ({
        id: v.id,
        title: v.title,
        ownerIds: v.owners.flatMap((o) => (o.memberId ? [o.memberId] : [])),
        dueDate: v.dueDate,
        status: v.status,
        nextStep: v.nextStep,
        front: v.front,
      }),
    ),
  };
}

function recordCall(db: Db, at: string, model: string, status: string, errorCode: string | null, usage?: { inputTokens: number; outputTokens: number }, latencyMs = 0, cost: number | null = null) {
  db.run(
    `INSERT INTO ai_calls (purpose, model, input_tokens, output_tokens, latency_ms, status, error_code, cost_estimate_usd, created_at)
     VALUES ('extract', ?, ?, ?, ?, ?, ?, ?, ?)`,
    model,
    usage?.inputTokens ?? 0,
    usage?.outputTokens ?? 0,
    latencyMs,
    status,
    errorCode,
    cost,
    at,
  );
}

const backoffMs = (attempts: number) => 60_000 * 2 ** (attempts - 1);

/** Processa a fila, uma análise por vez e uma execução por processo. Nunca lança: erro vira estado. */
export async function processQueue(deps: AnalysisDeps): Promise<QueueSummary> {
  const summary: QueueSummary = { done: 0, failed: 0, retrying: 0, waiting: 0, disabled: 0 };
  if (globals.__liaAnalysisRunning) return summary;
  globals.__liaAnalysisRunning = true;
  try {
    const now = deps.clock.now().toISOString();
    // Uma análise 'running' só existe se o processo caiu no meio dela (há um único processo e a trava acima).
    deps.db.run("UPDATE document_analyses SET status = 'pending' WHERE status = 'running'");
    const rows = deps.db.all<AnalysisRow>(
      `SELECT id, file_id, content_hash, attempts FROM document_analyses
        WHERE purpose = 'extract' AND analyzer_version = ?
          AND (status = 'waiting_registry'
               OR (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
               OR (status = 'disabled' AND ? <> 'disabled'))
        ORDER BY id`,
      ANALYZER_VERSION,
      now,
      deps.provider.name,
    );
    for (const row of rows) {
      try {
        const outcome = await analyzeOne(deps, row);
        summary[outcome]++;
      } catch (error) {
        // Falha inesperada em uma análise não derruba o resto da fila.
        logger.error("analysis.unexpected", { analysis_id: row.id, error });
        deps.db.run(
          "UPDATE document_analyses SET status = 'failed', error_code = 'internal', error_message = ? WHERE id = ?",
          "Erro inesperado na análise; detalhes no log do servidor.",
          row.id,
        );
        summary.failed++;
      }
    }
  } finally {
    globals.__liaAnalysisRunning = false;
  }
  return summary;
}

async function analyzeOne(deps: AnalysisDeps, row: AnalysisRow): Promise<keyof QueueSummary> {
  const { db } = deps;
  const at = () => deps.clock.now().toISOString();
  const fail = (status: "failed" | "pending" | "disabled", code: string, message: string, attempts: number, next: string | null = null) =>
    db.run(
      `UPDATE document_analyses SET status = ?, attempts = ?, next_attempt_at = ?, error_code = ?, error_message = ?, finished_at = ? WHERE id = ?`,
      status,
      attempts,
      next,
      code,
      message,
      status === "pending" ? null : at(),
      row.id,
    );

  if (!registryImported(db)) {
    db.run("UPDATE document_analyses SET status = 'waiting_registry' WHERE id = ?", row.id);
    return "waiting";
  }
  const source = getSource(db, row.file_id);
  const stored = getContent(db, row.file_id);
  if (!source || source.sync_status !== "processed" || source.processed_hash !== row.content_hash || stored?.extracted.kind !== "text" || stored.hash !== row.content_hash) {
    // A fonte mudou ou sumiu enquanto esperava: a análise desta versão não vale mais.
    db.run(
      `UPDATE document_analyses SET status = 'done', error_code = 'obsolete', error_message = 'Versão substituída antes da análise.', finished_at = ? WHERE id = ?`,
      at(),
      row.id,
    );
    return "done";
  }
  const doc = stored.extracted;
  if (doc.text.length > deps.maxInputChars) {
    fail("failed", "too_long", "Documento longo demais para análise; não foi truncado.", row.attempts);
    return "failed";
  }

  const debounce = deps.debounceMs ?? 0;
  const processedAt = source.last_processed_at ? Date.parse(source.last_processed_at) : 0;
  if (debounce > 0 && deps.clock.now().getTime() - processedAt < debounce) return "waiting";
  if (deps.dailyCallLimit !== undefined) {
    const since = new Date(deps.clock.now().getTime() - 24 * 3600_000).toISOString();
    const used = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM ai_calls WHERE created_at >= ?", since)?.n ?? 0;
    if (used >= deps.dailyCallLimit) {
      logger.warn("analysis.daily_limit", { used, limit: deps.dailyCallLimit });
      return "waiting";
    }
  }

  db.run("UPDATE document_analyses SET status = 'running' WHERE id = ?", row.id);
  const official = officialContext(db, deps.members);
  const prompt = buildExtractPrompt({
    members: deps.members.map((m) => ({ name: m.name, front: m.front })),
    fronts: official.fronts,
    activities: official.prompt,
    documentName: source.name,
    documentDate: source.doc_date,
    documentText: doc.text,
  });
  const label = source.name.replace(/\.[A-Za-z0-9]{1,5}$/, "").toLowerCase();

  let result;
  try {
    result = await deps.provider.extract({ label, system: prompt.system, user: prompt.user });
  } catch (error) {
    const ai = error instanceof AiError ? error : new AiError("unavailable", "Falha inesperada ao chamar a IA.", { cause: error });
    recordCall(db, at(), deps.provider.name, "error", ai.kind);
    logger.warn("analysis.provider_failed", { analysis_id: row.id, kind: ai.kind, error: ai });
    if (ai.kind === "disabled" || ai.kind === "not_configured") {
      fail("disabled", ai.kind, ai.safeMessage, row.attempts);
      return "disabled";
    }
    const attempts = row.attempts + 1;
    const retriable = ["rate_limited", "unavailable", "timeout", "truncated", "schema_invalid"].includes(ai.kind);
    if (retriable && attempts < MAX_ATTEMPTS) {
      fail("pending", ai.kind, ai.safeMessage, attempts, new Date(deps.clock.now().getTime() + backoffMs(attempts)).toISOString());
      return "retrying";
    }
    fail("failed", ai.kind, ai.safeMessage, attempts);
    return "failed";
  }

  const validated = validateExtraction(result.output, {
    documentText: doc.text,
    sections: doc.sections,
    members: deps.members,
    fronts: official.fronts,
    activities: official.validator,
  });

  // A chamada paga é registrada mesmo que a gravação abaixo falhe.
  recordCall(db, at(), result.model, "ok", null, result.usage, result.latencyMs, result.costUsd);
  db.tx(() => {
    const now = at();
    const live = db.get<{ status: string }>("SELECT status FROM document_analyses WHERE id = ?", row.id);
    if (live?.status !== "running") return;
    // A fonte pode ter mudado enquanto o modelo trabalhava: a análise desta versão não vale mais.
    const current = db.get<{ processed_hash: string | null }>("SELECT processed_hash FROM sources WHERE file_id = ?", row.file_id);
    if (current?.processed_hash !== row.content_hash) {
      db.run(
        "UPDATE document_analyses SET status = 'done', error_code = 'obsolete', error_message = 'Versão substituída durante a análise.', finished_at = ? WHERE id = ?",
        now,
        row.id,
      );
      return;
    }
    db.run(
      `UPDATE document_analyses SET status = 'done', attempts = ?, error_code = NULL, error_message = NULL, document_summary = ?,
         no_action_json = ?, invalid_json = ?, finished_at = ? WHERE id = ?`,
      row.attempts + 1,
      validated.summary,
      JSON.stringify(validated.noAction),
      JSON.stringify(validated.invalid),
      now,
      row.id,
    );

    // Sugestões pendentes de versões antigas deste arquivo são substituídas pela nova análise.
    const old = db.all<{ id: number; dedupe_key: string }>(
      "SELECT id, dedupe_key FROM suggestions WHERE source_file_id = ? AND source_version <> ? AND review_status = 'pendente'",
      row.file_id,
      row.content_hash,
    );
    for (const o of old) {
      db.run("UPDATE suggestions SET review_status = 'substituida', stale_since = COALESCE(stale_since, ?) WHERE id = ?", now, o.id);
    }
    const ids = new Map<string, number>();
    for (const suggestion of validated.suggestions) {
      ids.set(suggestion.dedupeKey, upsertSuggestion(db, suggestion, row, source.doc_date, now));
    }
    for (const o of old) {
      const replacement = ids.get(o.dedupe_key);
      if (replacement) db.run("UPDATE suggestions SET superseded_by = ? WHERE id = ?", replacement, o.id);
    }
    // Confirma o oficial (DN-11): a ata vira "origem histórica" da atividade.
    for (const n of validated.noAction) {
      if (!n.relatedActivityId) continue;
      db.run(
        `INSERT OR IGNORE INTO activity_references (activity_id, file_id, source_version, locator, quote_or_cell, relation, created_at)
         VALUES (?, ?, ?, '', ?, 'historical_origin', ?)`,
        n.relatedActivityId,
        row.file_id,
        source.drive_version ?? "",
        n.evidence.slice(0, 500),
        now,
      );
    }
  });
  logger.info("analysis.done", {
    analysis_id: row.id,
    suggestions: validated.suggestions.length,
    no_action: validated.noAction.length,
    invalid: validated.invalid.length,
    tokens_in: result.usage.inputTokens,
    tokens_out: result.usage.outputTokens,
  });
  return "done";
}

function currentValue(db: Db, activityId: string | null, field: keyof ProposedFields): unknown {
  if (!activityId) return null;
  if (field === "ownerIds") {
    return db
      .all<{ member_id: string }>("SELECT member_id FROM activity_owners WHERE activity_id = ? AND member_id IS NOT NULL ORDER BY member_id", activityId)
      .map((o) => o.member_id);
  }
  const column = { title: "title", nextStep: "next_step", dueDate: "due_date", front: "front", status: "status" }[field];
  return db.get<Record<string, unknown>>(`SELECT ${column} AS v FROM activities WHERE id = ?`, activityId)?.v ?? null;
}

/** Uma sugestão pendente por chave: repetição vira evidência extra da mesma (DN-12). */
function upsertSuggestion(db: Db, s: ValidSuggestion, row: AnalysisRow, docDate: string | null, now: string): number {
  const existing = db.get<{ id: number }>("SELECT id FROM suggestions WHERE dedupe_key = ? AND review_status = 'pendente'", s.dedupeKey);
  let id: number;
  if (existing) {
    id = existing.id;
  } else {
    id = Number(
      db.run(
        `INSERT INTO suggestions (analysis_id, origin, kind, target_activity_id, source_file_id, source_version, doc_date,
           rationale, uncertainties_json, dedupe_key, created_at)
         VALUES (?, 'ai', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        s.kind,
        s.targetActivityId,
        row.file_id,
        row.content_hash,
        docDate,
        s.rationale,
        JSON.stringify(s.uncertainties),
        s.dedupeKey,
        now,
      ).lastInsertRowid,
    );
    for (const field of Object.keys(s.fields) as Array<keyof ProposedFields>) {
      db.run(
        `INSERT INTO suggestion_fields (suggestion_id, field, current_value_json, proposed_value_json, uncertain) VALUES (?, ?, ?, ?, ?)`,
        id,
        FIELD_KEY[field],
        s.kind === "update" ? JSON.stringify(currentValue(db, s.targetActivityId, field)) : null,
        JSON.stringify(s.fields[field]),
        s.uncertainFields.includes(field) ? 1 : 0,
      );
    }
  }
  db.run(
    `INSERT OR IGNORE INTO suggestion_evidence (suggestion_id, file_id, source_version, locator, quote) VALUES (?, ?, ?, ?, ?)`,
    id,
    row.file_id,
    row.content_hash,
    s.locator,
    s.evidence,
  );
  return id;
}
