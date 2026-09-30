import Link from "next/link";
import { formatDateTimeBR } from "@/lib/datetime";
import { getConnection } from "@/server/auth/token-store";
import { getEnv, missingGoogleSettings } from "@/server/config/env";
import { getDb } from "@/server/db";
import { lastFinishedRun, lastSuccessfulRun } from "@/server/db/repos/sync-runs-repo";
import { logger } from "@/server/observability/logger";
import { Notice } from "./notice";

/**
 * Faixa global: aparece só quando há algo a corrigir (configuração, conexão perdida
 * ou encerrada, falha de sincronização). Diz desde quando os dados podem estar
 * desatualizados (CA-F1.3; FAQ do case, RNF-3).
 */
export function SyncBanner() {
  const link = (
    <Link href="/sincronizacao" className="font-semibold underline">
      Ver estado da sincronização
    </Link>
  );

  let env;
  try {
    env = getEnv();
  } catch {
    return <Notice tone="danger">Configuração inválida no .env.local. {link}</Notice>;
  }
  if (env.DRIVE_MODE === "google" && missingGoogleSettings(env).length > 0) {
    return <Notice tone="info">O Google Drive ainda não foi configurado. {link}</Notice>;
  }

  let state;
  try {
    const db = getDb();
    state = { connection: getConnection(db), last: lastFinishedRun(db), ok: lastSuccessfulRun(db) };
  } catch (error) {
    logger.error("banner.db_failed", { error });
    return <Notice tone="danger">Não foi possível ler o banco de dados local. Detalhes no log do servidor.</Notice>;
  }
  const { connection, last, ok } = state;
  const since = ok
    ? `Os dados exibidos são de ${formatDateTimeBR(ok.finishedAt ?? ok.startedAt)} e podem estar desatualizados desde então.`
    : "Ainda não há sincronização concluída.";

  if (env.DRIVE_MODE === "google" && connection?.status === "reauth_required") {
    return (
      <Notice tone="danger">
        Conexão com o Google perdida — reautorização necessária. {since} {link}
      </Notice>
    );
  }
  if (env.DRIVE_MODE === "google" && connection?.status === "disconnected" && ok) {
    return (
      <Notice tone="warn">
        Google Drive desconectado. {since} {link}
      </Notice>
    );
  }
  if (last?.status === "failed") {
    return (
      <Notice tone="warn">
        Falha na sincronização em {formatDateTimeBR(last.finishedAt ?? last.startedAt)}. {since} {link}
      </Notice>
    );
  }
  return null;
}
