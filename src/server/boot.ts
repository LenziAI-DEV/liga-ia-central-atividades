import { getDb } from "@/server/db";
import { recoverInterruptedRuns } from "@/server/db/repos/sync-runs-repo";
import { logger } from "@/server/observability/logger";

const globalForBoot = globalThis as unknown as { __liaBooted?: boolean };

/** Inicialização do servidor: migra o banco. O scheduler de sync entra na Fase 4. */
export function boot() {
  if (globalForBoot.__liaBooted) return;
  globalForBoot.__liaBooted = true;
  recoverInterruptedRuns(getDb(), new Date());
  logger.info("app.boot", { node: process.versions.node });
}
