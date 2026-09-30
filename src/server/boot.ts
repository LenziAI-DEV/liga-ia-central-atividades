import { getDb } from "@/server/db";
import { recoverInterruptedRuns } from "@/server/db/repos/sync-runs-repo";
import { logger } from "@/server/observability/logger";
import { startScheduler } from "@/server/sync/start-scheduler";

const globalForBoot = globalThis as unknown as { __liaBooted?: boolean };

/** Inicialização do servidor: migra o banco, recupera ciclos interrompidos e liga a sincronização automática. */
export function boot() {
  if (globalForBoot.__liaBooted) return;
  globalForBoot.__liaBooted = true;
  recoverInterruptedRuns(getDb(), new Date());
  logger.info("app.boot", { node: process.versions.node });
  try {
    startScheduler();
  } catch (error) {
    // Configuração inválida não derruba o servidor: a tela de sincronização mostra o erro.
    logger.error("sync.scheduler.start_failed", { error });
  }
}
