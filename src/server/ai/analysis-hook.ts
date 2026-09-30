import type { AppEnv } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { loadMembers } from "@/server/persona/members";
import type { AfterSyncContext } from "@/server/sync/sync-service";
import { enqueueAnalyses, processQueue } from "./analysis-service";
import { createProvider } from "./factory";

/**
 * Etapa pós-sincronização: enfileira as atas novas ou editadas e processa a fila em segundo
 * plano. Não espera a IA (o ciclo de sincronização não pode ficar preso a uma chamada de
 * minutos) e nunca lança: qualquer falha vira estado da análise (F7.10).
 */
export function analysisHook(env: AppEnv) {
  return (context: AfterSyncContext) => {
    try {
      enqueueAnalyses(context.db, env.INDEX_FILE_NAME, context.clock);
    } catch (error) {
      logger.error("analysis.enqueue_failed", { run_id: context.runId, error });
      return;
    }
    void processQueue({
      db: context.db,
      provider: createProvider(env),
      members: loadMembers(),
      clock: context.clock,
      indexFileName: env.INDEX_FILE_NAME,
      maxInputChars: env.AI_MAX_INPUT_CHARS,
      // Espera a versão ficar estável (padrão 2 min; 0 nos testes E2E) e limita a 100 chamadas por dia (custo previsível).
      debounceMs: env.AI_DEBOUNCE_SECONDS * 1000,
      dailyCallLimit: 100,
    }).catch((error) => logger.error("analysis.queue_failed", { error }));
  };
}
