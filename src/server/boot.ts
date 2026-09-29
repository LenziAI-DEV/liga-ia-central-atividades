import { getDb } from "@/server/db";
import { logger } from "@/server/observability/logger";

const globalForBoot = globalThis as unknown as { __liaBooted?: boolean };

/** Inicialização do servidor: migra o banco. O scheduler de sync entra na Fase 4. */
export function boot() {
  if (globalForBoot.__liaBooted) return;
  globalForBoot.__liaBooted = true;
  getDb();
  logger.info("app.boot", { node: process.versions.node });
}
