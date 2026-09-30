import { resolveRegistry } from "@/server/authority/registry-locator";
import type { AfterSyncContext } from "@/server/sync/sync-service";
import { logger } from "@/server/observability/logger";
import { loadMembers } from "@/server/persona/members";
import { importInitialRegistry } from "./registry-importer";

/**
 * Etapa pós-sincronização: se o registro vigente está resolvido e ainda não houve
 * importação, faz a importação inicial. Sem certeza sobre a fonte, não faz nada (F4.5).
 */
export function registryImportHook(indexFileName: string) {
  return (context: AfterSyncContext) => {
    const result = importInitialRegistry(
      context.db,
      resolveRegistry(context.db, indexFileName),
      loadMembers(),
      context.clock,
    );
    if (result.status === "imported") {
      logger.info("registry.import.done", { run_id: context.runId, imported: result.imported, issues: result.issues.length });
    } else if (result.status === "refused") {
      logger.info("registry.import.pending", { run_id: context.runId, reason: result.reason });
    }
  };
}
