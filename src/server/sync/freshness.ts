import type { Db } from "@/server/db/client";
import { lastFinishedRun, lastSuccessfulRun } from "@/server/db/repos/sync-runs-repo";

export interface Freshness {
  /** Os dados exibidos podem estar defasados em relação ao Drive. */
  stale: boolean;
  reason: "failed" | "old" | null;
  /** Instante do último ciclo que leu a pasta (sucesso total ou parcial); null se nunca houve. */
  lastOkAt: string | null;
}

/**
 * "Potencialmente desatualizado" é derivado (ARCHITECTURE §6.3): o último ciclo falhou, ou
 * o último sucesso foi há mais de 2× o intervalo. Sem nenhum sucesso ainda não há dado
 * para ficar defasado (a tela de sincronização já explica).
 */
export function syncFreshness(db: Db, intervalSeconds: number, now: Date): Freshness {
  const ok = lastSuccessfulRun(db);
  if (!ok) return { stale: false, reason: null, lastOkAt: null };
  const lastOkAt = ok.finishedAt ?? ok.startedAt;
  if (lastFinishedRun(db)?.status === "failed") return { stale: true, reason: "failed", lastOkAt };
  if (now.getTime() - Date.parse(lastOkAt) > 2 * intervalSeconds * 1000) return { stale: true, reason: "old", lastOkAt };
  return { stale: false, reason: null, lastOkAt };
}
