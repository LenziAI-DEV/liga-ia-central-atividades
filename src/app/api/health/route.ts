import { getConnection } from "@/server/auth/token-store";
import { getDb } from "@/server/db";
import { logger } from "@/server/observability/logger";
import { getScheduler, getSchedulerStartError } from "@/server/sync/scheduler";

export const dynamic = "force-dynamic";

/** Diagnóstico para a demonstração: banco, agendador e conexão. Sem segredos nem dados de atividades. */
export function GET() {
  try {
    const db = getDb();
    const row = db.get<{ ok: number }>("SELECT 1 AS ok");
    const scheduler = getScheduler()?.status();
    return Response.json({
      db: row?.ok === 1 ? "ok" : "error",
      scheduler: scheduler
        ? {
            running: scheduler.running,
            lastStatus: scheduler.lastStatus,
            lastCycleAt: scheduler.lastCycleAt ? new Date(scheduler.lastCycleAt).toISOString() : null,
            consecutiveFailures: scheduler.consecutiveFailures,
          }
        : { running: false, ...(getSchedulerStartError() ? { error: getSchedulerStartError() } : {}) },
      connection: getConnection(db)?.status ?? "none",
    });
  } catch (error) {
    logger.error("health.failed", { error });
    return Response.json({ db: "error" }, { status: 503 });
  }
}
