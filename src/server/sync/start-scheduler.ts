import { getEnv } from "@/server/config/env";
import { requestSync } from "@/server/container";
import { getDb } from "@/server/db";
import { lastSuccessfulRun } from "@/server/db/repos/sync-runs-repo";
import { logger } from "@/server/observability/logger";
import { createScheduler, ensureScheduler } from "./scheduler";

const FIRST_DELAY_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/**
 * Liga a sincronização automática (F3.1): primeiro ciclo ~5 s depois do boot e depois a
 * cada `SYNC_INTERVAL_SECONDS`. Sem conexão ou com autorização perdida, o ciclo só
 * devolve `not_connected` (não chama o Google) e o estado aparece na tela.
 */
export function startScheduler() {
  const env = getEnv();
  const intervalMs = env.SYNC_INTERVAL_SECONDS * 1000;
  let lastLogged = "";
  ensureScheduler(() =>
    createScheduler({
      intervalMs,
      maxBackoffMs: Math.max(MAX_BACKOFF_MS, intervalMs),
      firstDelayMs: FIRST_DELAY_MS,
      runCycle: () => requestSync(lastSuccessfulRun(getDb()) ? "scheduled" : "initial"),
      onCycle: (result, info) => {
        // Ciclos iguais em sequência (ex.: "not_connected" a cada minuto) não enchem o log.
        const key = `${result.status}:${info.failures}`;
        if ("error" in result) logger.error("sync.scheduler.cycle_error", { error: result.error, failures: info.failures });
        else if (key !== lastLogged || result.status !== "success") {
          logger.info("sync.scheduler.cycle", { status: result.status, failures: info.failures, next_in_ms: info.nextInMs });
        }
        lastLogged = key;
      },
    }),
  );
  logger.info("sync.scheduler.started", { interval_ms: intervalMs });
}
