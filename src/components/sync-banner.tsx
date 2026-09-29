import Link from "next/link";
import { formatDateTimeBR } from "@/lib/datetime";
import { getConnection } from "@/server/auth/token-store";
import { getEnv, missingGoogleSettings } from "@/server/config/env";
import { getDb } from "@/server/db";
import { lastFinishedRun, lastSuccessfulRun } from "@/server/db/repos/sync-runs-repo";
import { Notice } from "./notice";

/**
 * Faixa global: aparece só quando há algo a corrigir (configuração, conexão perdida,
 * falha de sincronização). Mostra o último estado confirmado (FAQ do case, RNF-3).
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
    return (
      <Notice tone="danger">
        Configuração inválida no .env.local. {link}
      </Notice>
    );
  }
  if (env.DRIVE_MODE === "google" && missingGoogleSettings(env).length > 0) {
    return <Notice tone="info">O Google Drive ainda não foi configurado. {link}</Notice>;
  }

  const db = getDb();
  const connection = getConnection(db);
  if (env.DRIVE_MODE === "google" && connection?.status === "reauth_required") {
    return (
      <Notice tone="danger">
        Conexão com o Google perdida — reautorização necessária. Os dados exibidos são os últimos confirmados. {link}
      </Notice>
    );
  }

  const last = lastFinishedRun(db);
  if (last?.status === "failed") {
    const ok = lastSuccessfulRun(db);
    return (
      <Notice tone="warn">
        Falha na sincronização em {formatDateTimeBR(last.finishedAt ?? last.startedAt)}.{" "}
        {ok ? `Último sucesso em ${formatDateTimeBR(ok.finishedAt ?? ok.startedAt)}; ` : ""}
        os dados podem estar desatualizados. {link}
      </Notice>
    );
  }
  return null;
}
