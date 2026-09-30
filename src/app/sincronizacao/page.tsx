import type { Metadata } from "next";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { RegistryStatus } from "@/components/registry-status";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { getArea } from "@/lib/areas";
import { formatDateBR, formatDateTimeBR, isoDateInSaoPaulo } from "@/lib/datetime";
import { RUN_STATUS, RUN_TRIGGER, SOURCE_KIND, SOURCE_STATUS } from "@/lib/labels";
import { getImportReport } from "@/server/activities/import-hook";
import { resolveRegistry } from "@/server/authority/registry-locator";
import { getConnection } from "@/server/auth/token-store";
import { getEnv, missingGoogleSettings, type AppEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { SETTING, getSetting, type RootFolder } from "@/server/db/repos/settings-repo";
import { listSources } from "@/server/db/repos/sources-repo";
import { currentRun, lastFinishedRun, lastSuccessfulRun, recentRuns } from "@/server/db/repos/sync-runs-repo";
import { toSafeMessage } from "@/server/errors";
import { disconnectAction, syncNowAction } from "./actions";

const area = getArea("/sincronizacao");
export const metadata: Metadata = { title: area.label };

const CONNECT_ERRORS: Record<string, string> = {
  config: "Faltam variáveis no .env.local para conectar o Google (veja abaixo).",
  inicio: "Não foi possível iniciar a autorização. Confira GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local.",
  acesso_negado: "O acesso foi negado na tela do Google. Nada foi alterado.",
  state_invalido:
    "Não foi possível validar a resposta do Google (sessão expirada ou endereço diferente). Abra o app por http://localhost:3000 e tente de novo.",
  escopo_invalido: "A autorização não corresponde a somente leitura do Drive. Conecte de novo e aceite o acesso pedido.",
  pasta_inacessivel: "A pasta de DRIVE_TEST_FOLDER_ID não foi encontrada ou esta conta Google não tem acesso a ela.",
  pasta_invalida: "O ID em DRIVE_TEST_FOLDER_ID não é de uma pasta ativa do Drive (confira se ela não está na lixeira).",
  google_indisponivel:
    "O Google não respondeu a tempo ao conferir a pasta. Nada foi gravado; tente conectar de novo em instantes.",
  troca_falhou:
    "Não foi possível concluir a autorização. Confira o Client Secret e se o URI de redirecionamento cadastrado é exatamente http://localhost:3000/api/auth/google/callback.",
};

const SYNC_RESULTS: Record<string, { tone: "ok" | "warn" | "danger" | "info"; text: string }> = {
  success: { tone: "ok", text: "Sincronização concluída." },
  partial: { tone: "warn", text: "Sincronização concluída com avisos — veja os arquivos com falha na tabela." },
  failed: { tone: "danger", text: "A sincronização falhou — veja o motivo em “Sincronização”." },
  already_running: { tone: "info", text: "Já havia uma sincronização em andamento; os resultados aparecem ao terminar." },
  not_connected: { tone: "warn", text: "Conecte a conta Google antes de sincronizar." },
};

export default async function Page(props: PageProps<"/sincronizacao">) {
  const params = await props.searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  let env: AppEnv;
  try {
    env = getEnv();
  } catch (error) {
    return (
      <>
        <PageHeader title={area.label} description={area.description} />
        <Notice tone="danger">{toSafeMessage(error)}</Notice>
      </>
    );
  }

  const db = getDb();
  const missing = env.DRIVE_MODE === "google" ? missingGoogleSettings(env) : [];
  const connection = getConnection(db);
  const connected = env.DRIVE_MODE === "fake" || connection?.status === "connected";
  const root = getSetting<RootFolder>(db, SETTING.rootFolder);
  const running = currentRun(db);
  const last = lastFinishedRun(db);
  const lastOk = lastSuccessfulRun(db);
  const runs = recentRuns(db, 5);
  const sources = listSources(db).filter((s) => s.kind !== "folder");
  const count = (...statuses: string[]) => sources.filter((s) => statuses.includes(s.sync_status)).length;

  // `Object.hasOwn`: `?erro=__proto__` não pode achar propriedades herdadas.
  const errorKey = one("erro");
  const connectError = errorKey && Object.hasOwn(CONNECT_ERRORS, errorKey) ? CONNECT_ERRORS[errorKey] : undefined;
  const syncKey = one("sync");
  const syncResult = syncKey && Object.hasOwn(SYNC_RESULTS, syncKey) ? SYNC_RESULTS[syncKey] : undefined;
  const disconnected = one("desconectado");

  return (
    <>
      <PageHeader title={area.label} description={area.description} />

      <div className="space-y-3" aria-live="polite">
        {one("conectado") && <Notice tone="ok">Conta Google conectada. A carga inicial da pasta foi iniciada.</Notice>}
        {disconnected === "1" && (
          <Notice tone="ok">Conta desconectada: o acesso foi revogado no Google e os tokens locais foram apagados.</Notice>
        )}
        {disconnected === "local" && (
          <Notice tone="warn">
            Os tokens locais foram apagados, mas não foi possível revogar o acesso no Google agora. Para concluir, remova o
            acesso em Conta Google › Segurança › Suas conexões com apps e serviços de terceiros.
          </Notice>
        )}
        {errorKey && <Notice tone="danger">{connectError ?? "Não foi possível conectar a conta Google."}</Notice>}
        {syncResult && <Notice tone={syncResult.tone}>{syncResult.text}</Notice>}
      </div>

      <section aria-labelledby="conexao" className="mt-8">
        <h2 id="conexao" className="text-xl font-semibold">
          Conexão com o Google Drive
        </h2>
        <div className="mt-3 space-y-3">
          {env.DRIVE_MODE === "fake" ? (
            <Notice tone="info">Modo de demonstração com Drive simulado (DRIVE_MODE=fake). Nenhum dado do Google é lido.</Notice>
          ) : missing.length > 0 ? (
            <Notice tone="warn" title="Configuração pendente:">
              preencha no <code>.env.local</code>: {missing.join(", ")}. Rode <code>npm run setup</code> para criar o arquivo e
              siga o passo a passo do README. Depois reinicie o app.
            </Notice>
          ) : connection?.status === "connected" ? (
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="ok">Conectado</StatusBadge>
              <span>
                {connection.accountLabel ? `Conta ${connection.accountLabel}. ` : ""}
                Acesso <strong>somente leitura</strong>.
                {connection.connectedAt && (
                  <>
                    {" "}
                    Autorizado em {formatDateTimeBR(connection.connectedAt)}. Em modo de teste do Google, a autorização expira
                    por volta de{" "}
                    {formatDateBR(isoDateInSaoPaulo(new Date(Date.parse(connection.connectedAt) + 7 * 86_400_000)))} — reconecte
                    antes disso.
                  </>
                )}
              </span>
              <form action={disconnectAction}>
                <SubmitButton variant="secondary" pendingLabel="Desconectando…">
                  Desconectar
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {connection?.status === "reauth_required" && (
                <Notice tone="danger">
                  A autorização do Google expirou ou foi revogada. As informações abaixo são as últimas confirmadas e podem estar
                  desatualizadas.
                </Notice>
              )}
              <a
                href="/api/auth/google/start"
                className="inline-flex items-center rounded bg-[var(--lia-blue)] px-4 py-2 font-medium text-[var(--paper)] hover:bg-[var(--lia-blue-dark)]"
              >
                {connection?.status === "reauth_required" ? "Reconectar conta Google" : "Conectar conta Google"}
              </a>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="pasta" className="mt-8">
        <h2 id="pasta" className="text-xl font-semibold">
          Pasta monitorada
        </h2>
        <div className="mt-3 space-y-1">
          {root ? (
            <p>
              {root.url ? (
                <a href={root.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--lia-blue)] underline">
                  {root.name}
                  <span className="sr-only"> (abre no Google Drive)</span>
                </a>
              ) : (
                <strong>{root.name}</strong>
              )}
            </p>
          ) : (
            <p className="text-[var(--ink-muted)]">Ainda não lida.</p>
          )}
          <p className="text-[var(--ink-muted)]">
            Escopo: esta pasta e todas as suas subpastas. Nada fora dela é lido, e nada é alterado no Drive.
          </p>
        </div>
      </section>

      <RegistryStatus resolution={resolveRegistry(db, env.INDEX_FILE_NAME)} report={getImportReport(db)} />

      <section aria-labelledby="sincronizacao" className="mt-8">
        <h2 id="sincronizacao" className="text-xl font-semibold">
          Sincronização
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium">Último sucesso</dt>
          <dd>{lastOk ? formatDateTimeBR(lastOk.finishedAt ?? lastOk.startedAt) : "nenhum ainda"}</dd>
          <dt className="font-medium">Última tentativa</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {running ? (
              <StatusBadge tone="info">Em andamento desde {formatDateTimeBR(running.startedAt)}</StatusBadge>
            ) : last ? (
              <>
                <StatusBadge tone={RUN_STATUS[last.status].tone}>{RUN_STATUS[last.status].label}</StatusBadge>
                <span>
                  {formatDateTimeBR(last.finishedAt ?? last.startedAt)} ({RUN_TRIGGER[last.trigger]})
                </span>
              </>
            ) : (
              "nenhuma ainda"
            )}
          </dd>
          {last?.errorMessage && (
            <>
              <dt className="font-medium">Motivo</dt>
              <dd>{last.errorMessage}</dd>
            </>
          )}
        </dl>
        <form action={syncNowAction} className="mt-4">
          <SubmitButton pendingLabel="Sincronizando…" disabled={!connected}>
            Sincronizar agora
          </SubmitButton>
        </form>

        {runs.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">Últimas execuções</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {runs.map((run) => (
                <li key={run.id}>
                  {formatDateTimeBR(run.startedAt)} · {RUN_TRIGGER[run.trigger]} · {RUN_STATUS[run.status].label} ·{" "}
                  {run.counts.processed} processado(s), {run.counts.unchanged} sem mudança, {run.counts.failed} com falha,{" "}
                  {run.counts.unavailable} indisponível(is)
                  {run.counts.inconclusive > 0 && <>, {run.counts.inconclusive} a confirmar</>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="arquivos" className="mt-8">
        <h2 id="arquivos" className="text-xl font-semibold">
          Arquivos da pasta
        </h2>
        <p className="mt-2 text-[var(--ink-muted)]">
          {count("processed")} processado(s) · {count("unsupported")} não processado(s) · {count("failed")} com falha ·{" "}
          {count("unavailable", "out_of_scope")} indisponível(is)
        </p>
        {sources.length === 0 ? (
          <p className="mt-3">Nenhum arquivo sincronizado ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Arquivos da pasta monitorada e o estado de cada um</caption>
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th scope="col" className="py-2 pr-4">Arquivo</th>
                  <th scope="col" className="py-2 pr-4">Tipo</th>
                  <th scope="col" className="py-2 pr-4">Estado</th>
                  <th scope="col" className="py-2 pr-4">Detalhe</th>
                  <th scope="col" className="py-2">Modificado no Drive</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => {
                  const status = SOURCE_STATUS[source.sync_status];
                  return (
                    <tr key={source.file_id} className="border-b border-[var(--line)] align-top">
                      <td className="py-2 pr-4">
                        {source.web_url ? (
                          <a href={source.web_url} target="_blank" rel="noopener noreferrer" className="text-[var(--lia-blue)] underline">
                            {source.path}
                            <span className="sr-only"> (abre no Google Drive)</span>
                          </a>
                        ) : (
                          source.path
                        )}
                      </td>
                      <td className="py-2 pr-4">{SOURCE_KIND[source.kind]}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                      <td className="py-2 pr-4">
                        {source.status_reason ?? "—"}
                        {source.removed_at && <> Desde {formatDateTimeBR(source.removed_at)}.</>}
                      </td>
                      <td className="py-2">{source.modified_time ? formatDateTimeBR(source.modified_time) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
