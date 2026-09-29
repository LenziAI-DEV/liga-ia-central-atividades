import type { Db } from "../client";

export type SyncTrigger = "initial" | "scheduled" | "manual";
export type RunStatus = "running" | "success" | "partial" | "failed";

export interface SyncCounts {
  seen: number;
  processed: number;
  unchanged: number;
  unsupported: number;
  failed: number;
  unavailable: number;
  folders: number;
}

export const emptyCounts = (): SyncCounts => ({
  seen: 0,
  processed: 0,
  unchanged: 0,
  unsupported: 0,
  failed: 0,
  unavailable: 0,
  folders: 0,
});

export interface SyncRun {
  id: number;
  trigger: SyncTrigger;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  counts: SyncCounts;
  errorCode: string | null;
  errorMessage: string | null;
}

interface SyncRunRow {
  id: number;
  trigger_kind: SyncTrigger;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  counts_json: string;
  error_code: string | null;
  error_message: string | null;
}

function toRun(row: SyncRunRow | undefined): SyncRun | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    trigger: row.trigger_kind,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    counts: { ...emptyCounts(), ...(JSON.parse(row.counts_json) as Partial<SyncCounts>) },
    errorCode: row.error_code,
    errorMessage: row.error_message,
  };
}

const LEASE_MS = 10 * 60_000;

/**
 * Abre uma execução se nenhuma outra estiver ativa (execução única). Execuções
 * com lease vencido (servidor caiu no meio) viram `failed(interrupted)`.
 */
export function acquireRun(db: Db, trigger: SyncTrigger, now: Date): number | null {
  return db.tx(() => {
    const nowIso = now.toISOString();
    db.run(
      `UPDATE sync_runs SET status = 'failed', finished_at = ?, error_code = 'interrupted',
         error_message = 'Execução interrompida (o servidor foi reiniciado durante a sincronização).'
       WHERE status = 'running' AND lease_until < ?`,
      nowIso,
      nowIso,
    );
    if (db.get("SELECT id FROM sync_runs WHERE status = 'running'")) return null;
    const result = db.run(
      "INSERT INTO sync_runs (trigger_kind, status, started_at, lease_until) VALUES (?, 'running', ?, ?)",
      trigger,
      nowIso,
      new Date(now.getTime() + LEASE_MS).toISOString(),
    );
    return Number(result.lastInsertRowid);
  });
}

/** No boot: qualquer execução "running" é de um processo anterior (um processo por instalação). */
export function recoverInterruptedRuns(db: Db, now: Date) {
  db.run(
    `UPDATE sync_runs SET status = 'failed', finished_at = ?, error_code = 'interrupted',
       error_message = 'Execução interrompida (o servidor foi reiniciado durante a sincronização).'
     WHERE status = 'running'`,
    now.toISOString(),
  );
}

export function finishRun(
  db: Db,
  id: number,
  status: Exclude<RunStatus, "running">,
  counts: SyncCounts,
  now: Date,
  error?: { code: string; message: string },
) {
  db.run(
    `UPDATE sync_runs SET status = ?, finished_at = ?, lease_until = NULL, counts_json = ?,
       error_code = ?, error_message = ? WHERE id = ?`,
    status,
    now.toISOString(),
    JSON.stringify(counts),
    error?.code ?? null,
    error?.message ?? null,
    id,
  );
}

export function currentRun(db: Db): SyncRun | undefined {
  return toRun(db.get<SyncRunRow>("SELECT * FROM sync_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1"));
}

export function lastFinishedRun(db: Db): SyncRun | undefined {
  return toRun(db.get<SyncRunRow>("SELECT * FROM sync_runs WHERE status <> 'running' ORDER BY id DESC LIMIT 1"));
}

/** Último ciclo que leu a pasta com sucesso (total ou parcial). */
export function lastSuccessfulRun(db: Db): SyncRun | undefined {
  return toRun(
    db.get<SyncRunRow>("SELECT * FROM sync_runs WHERE status IN ('success', 'partial') ORDER BY id DESC LIMIT 1"),
  );
}

export function recentRuns(db: Db, limit = 5): SyncRun[] {
  return db
    .all<SyncRunRow>("SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?", limit)
    .map((row) => toRun(row)!);
}
