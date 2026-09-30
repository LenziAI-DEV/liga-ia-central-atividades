import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeBR } from "@/lib/datetime";
import { SOURCE_KIND, SOURCE_STATUS } from "@/lib/labels";
import { getDb } from "@/server/db";
import { getSource, listActivitiesCiting, listVersions } from "@/server/db/repos/sources-repo";

export const metadata: Metadata = { title: "Fonte" };

const AUTHORITY: Record<string, string> = {
  direcao_ativo: "direção — ativo",
  direcao_parcial: "direção — parcial",
  registro_vigente: "registro de atividades vigente",
  ata: "ata",
  historico: "histórico/superado",
  sem_autoridade: "sem autoridade definida",
};

const RELATION: Record<string, string> = {
  imported_from: "importada daqui",
  historical_origin: "origem histórica",
  updated_by: "atualizada por esta fonte",
  created_by: "criada a partir desta fonte",
};

const dateOrDash = (iso: string | null) => (iso ? formatDateTimeBR(iso) : "—");

export default async function Page(props: PageProps<"/fontes/[fileId]">) {
  const { fileId } = await props.params;
  const db = getDb();
  const source = getSource(db, fileId);
  if (!source) notFound();
  const status = SOURCE_STATUS[source.sync_status];
  const versions = listVersions(db, source.file_id);
  const citing = listActivitiesCiting(db, source.file_id);

  return (
    <>
      <PageHeader title={source.name} description={`Caminho: ${source.path}`}>
        <p className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          <span>{SOURCE_KIND[source.kind]}</span>
          {source.web_url?.startsWith("https://") ? (
            <a href={source.web_url} className="text-[var(--lia-blue)] underline underline-offset-2">
              Abrir no Google Drive
            </a>
          ) : null}
        </p>
      </PageHeader>

      <section aria-labelledby="estado" className="mb-8">
        <h2 id="estado" className="text-xl font-semibold">
          Estado
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <dt className="text-[var(--ink-muted)]">Detalhe</dt>
          <dd>{source.status_reason ?? "—"}</dd>
          <dt className="text-[var(--ink-muted)]">Autoridade</dt>
          <dd>
            {source.authority_class ? AUTHORITY[source.authority_class] ?? source.authority_class : "ainda não classificada"}
            {source.authority_reason ? ` (${source.authority_reason})` : ""}
          </dd>
          <dt className="text-[var(--ink-muted)]">Primeira detecção</dt>
          <dd>{dateOrDash(source.first_seen_at)}</dd>
          <dt className="text-[var(--ink-muted)]">Modificado no Drive</dt>
          <dd>{dateOrDash(source.modified_time)}</dd>
          <dt className="text-[var(--ink-muted)]">Último processamento</dt>
          <dd>{dateOrDash(source.last_processed_at)}</dd>
          <dt className="text-[var(--ink-muted)]">Última vez vista na pasta</dt>
          <dd>{dateOrDash(source.last_seen_at)}</dd>
          <dt className="text-[var(--ink-muted)]">Indisponível desde</dt>
          <dd>{dateOrDash(source.removed_at)}</dd>
        </dl>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Da primeira detecção ao processamento é o tempo que o app levou para perceber o arquivo (meta interna: até 5 minutos).
        </p>
      </section>

      <section aria-labelledby="versoes" className="mb-8">
        <h2 id="versoes" className="text-xl font-semibold">
          Versões processadas
        </h2>
        {versions.length === 0 ? (
          <p className="mt-2">Nenhuma versão processada ainda.</p>
        ) : (
          <ol className="mt-2 list-decimal pl-5">
            {versions.map((v) => (
              <li key={`${v.content_hash}-${v.processed_at}`}>
                {formatDateTimeBR(v.processed_at)} · versão do Drive {v.drive_version ?? "—"} · conteúdo{" "}
                <code>{v.content_hash.slice(0, 12)}</code>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="atividades">
        <h2 id="atividades" className="text-xl font-semibold">
          Atividades que citam esta fonte
        </h2>
        {citing.length === 0 ? (
          <p className="mt-2">Nenhuma atividade cita esta fonte.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5">
            {citing.map((a) => (
              <li key={`${a.id}-${a.relation}`}>
                <Link href={`/atividades/${encodeURIComponent(a.id)}`} className="text-[var(--lia-blue)] underline underline-offset-2">
                  {a.id} · {a.title}
                </Link>{" "}
                ({RELATION[a.relation] ?? a.relation})
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
