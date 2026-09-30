import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { AttentionGroup, ConfirmedGroup, DocumentsGroup, PendingGroup, UncertainGroup } from "@/components/personal-feed";
import { StaleNote } from "@/components/stale-note";
import { getArea } from "@/lib/areas";
import { formatDateTimeBR, isoDateInSaoPaulo } from "@/lib/datetime";
import { getDb } from "@/server/db";
import { documents, forPersona } from "@/server/feed/change-feed";
import { getVisit, loadStartAt, recordVisit, resolveMarker } from "@/server/feed/visits";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

const area = getArea("/novidades");
export const metadata: Metadata = { title: area.label };

const PERIODS: ReadonlyArray<{ param: string | null; label: string }> = [
  { param: null, label: "Desde a minha última visita" },
  { param: "24h", label: "Últimas 24 horas" },
  { param: "7d", label: "Últimos 7 dias" },
  { param: "carga", label: "Desde a carga inicial" },
];

export default async function Page(props: PageProps<"/novidades">) {
  const params = await props.searchParams;
  const desde = typeof params.desde === "string" ? params.desde : undefined;
  const persona = await getCurrentPersona();
  if (!persona) {
    return (
      <>
        <PageHeader title={area.label} description={area.description} />
        <Notice tone="info">Escolha uma persona no topo da página para ver o que mudou para você.</Notice>
      </>
    );
  }

  const db = getDb();
  const now = new Date();
  // O marco é lido antes de gravar esta visita, senão o resumo sempre abriria vazio.
  const marker = resolveMarker({ param: desde, visit: getVisit(db, persona.id), loadStart: loadStartAt(db, now.toISOString()), now });
  const today = isoDateInSaoPaulo(now);
  const feed = forPersona(db, listMembers(), persona, marker.since, today);
  const news = documents(db, marker.since);
  recordVisit(db, persona.id, now);
  const activeParam = PERIODS.some((p) => p.param === desde) ? (desde ?? null) : desde ? "custom" : null;

  return (
    <>
      <PageHeader title={`O que mudou para você — ${persona.name}`} description={area.description} />
      <p className="mb-2">
        Mostrando o que mudou {marker.label}, a partir de <time dateTime={marker.since}>{formatDateTimeBR(marker.since)}</time>.
      </p>
      <nav aria-label="Período do resumo" className="mb-6">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {PERIODS.map((p) => (
            <li key={p.label}>
              <Link
                href={p.param ? `/novidades?desde=${p.param}` : "/novidades"}
                aria-current={activeParam === p.param ? "true" : undefined}
                className={
                  activeParam === p.param
                    ? "font-semibold text-[var(--ink)] underline underline-offset-4"
                    : "text-[var(--lia-blue)] underline underline-offset-4"
                }
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <StaleNote />
      {feed.empty ? (
        <div className="mb-8">
          <Notice tone="info">
            Nada mudou para você desde <time dateTime={marker.since}>{formatDateTimeBR(marker.since)}</time>.
          </Notice>
        </div>
      ) : (
        <>
          <ConfirmedGroup items={feed.confirmed} />
          <PendingGroup items={feed.pending} />
          <UncertainGroup items={feed.uncertain} />
          <AttentionGroup items={feed.attention} today={today} />
        </>
      )}
      <DocumentsGroup items={news} />
      <p className="text-sm text-[var(--ink-muted)]">
        Todas as fontes da pasta são visíveis a todas as personas neste protótipo. Datas, responsáveis e estados vêm dos registros oficiais; só o resumo de cada documento é gerado por IA.
      </p>
    </>
  );
}
