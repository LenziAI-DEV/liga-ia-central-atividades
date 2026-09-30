import { getDb } from "@/server/db";
import { recoverInterruptedRuns } from "@/server/db/repos/sync-runs-repo";
import { logger } from "@/server/observability/logger";
import { setSchedulerStartError } from "@/server/sync/scheduler";
import { startScheduler } from "@/server/sync/start-scheduler";

const globalForBoot = globalThis as unknown as { __liaBooted?: boolean };

/**
 * Inicialização do servidor: migra o banco, recupera ciclos interrompidos e liga a
 * sincronização automática. Nada aqui derruba o servidor: banco ou configuração inválidos
 * ficam no log e nas telas (que já mostram o erro), e a marca de "iniciado" só vale se deu certo.
 */
export function boot() {
  if (globalForBoot.__liaBooted) return;
  try {
    recoverInterruptedRuns(getDb(), new Date());
    logger.info("app.boot", { node: process.versions.node });
    startScheduler();
    globalForBoot.__liaBooted = true;
    setSchedulerStartError(null);
  } catch (error) {
    setSchedulerStartError("start_failed");
    logger.error("app.boot_failed", { error });
  }
}
