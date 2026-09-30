import { resolveRegistry } from "@/server/authority/registry-locator";
import type { Db } from "@/server/db/client";
import { getSetting, setSetting, SETTING } from "@/server/db/repos/settings-repo";
import { logger } from "@/server/observability/logger";
import { loadMembers } from "@/server/persona/members";
import type { AfterSyncContext } from "@/server/sync/sync-service";
import { diffRegistry } from "./registry-diff";
import { importInitialRegistry, type ImportIssue } from "./registry-importer";

/** Último resultado da importação do registro, para a tela mostrar o que ficou de fora. */
export interface ImportReport {
  at: string;
  state: "imported" | "pending" | "error";
  imported: number;
  /** Motivo da pendência ou do erro, em texto seguro para exibir. */
  message: string | null;
  issues: ImportIssue[];
}

export function getImportReport(db: Db): ImportReport | undefined {
  return getSetting<ImportReport>(db, SETTING.registryImport);
}

/**
 * Etapa pós-sincronização: se o registro vigente está resolvido e ainda não houve
 * importação, faz a importação inicial. Sem certeza sobre a fonte, não faz nada (F4.5).
 * Falha ou linhas puladas ficam registradas para a tela (falha nunca vira ausência).
 */
export function registryImportHook(indexFileName: string) {
  return (context: AfterSyncContext) => {
    const { db, runId, clock } = context;
    const at = clock.now().toISOString();
    const save = (report: Omit<ImportReport, "at">) => setSetting(db, SETTING.registryImport, { at, ...report }, at);
    try {
      const members = loadMembers();
      const result = importInitialRegistry(db, resolveRegistry(db, indexFileName), members, clock);
      if (result.status === "imported") {
        save({ state: "imported", imported: result.imported, message: null, issues: result.issues });
        logger.info("registry.import.done", { run_id: runId, imported: result.imported, issues: result.issues.length });
      } else if (result.status === "already_imported") {
        // Registro já importado: uma versão nova vira sugestões, nunca escrita direta (DN-02).
        const diff = diffRegistry(db, indexFileName, members, clock);
        if (diff.status === "compared") {
          save({
            state: "imported",
            imported: 0,
            message: `Nova versão do registro comparada com o valor oficial: ${diff.suggestions} sugestão(ões) para revisar.`,
            issues: diff.warnings,
          });
          logger.info("registry.diff.done", { run_id: runId, suggestions: diff.suggestions, warnings: diff.warnings.length });
        }
      } else if (result.status === "refused") {
        save({ state: "pending", imported: 0, message: result.reason, issues: result.issues ?? [] });
        logger.info("registry.import.pending", { run_id: runId, reason: result.reason });
      }
    } catch (error) {
      save({
        state: "error",
        imported: 0,
        message: "A importação das atividades falhou; nada foi gravado. Os detalhes estão no log do servidor.",
        issues: [],
      });
      logger.error("registry.import.failed", { run_id: runId, error });
    }
  };
}
