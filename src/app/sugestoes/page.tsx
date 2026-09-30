import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { StaleNote } from "@/components/stale-note";
import { StatusBadge } from "@/components/status-badge";
import { getArea } from "@/lib/areas";
import { formatDateBR, formatDateTimeBR } from "@/lib/datetime";
import { displayQuote, formatFieldValue, SUGGESTION_FIELD_LABEL } from "@/lib/field-format";
import { listAnalyses, listSuggestions, type SuggestionView } from "@/server/ai/suggestion-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";
import { retryAnalysisAction } from "./actions";

const area = getArea("/sugestoes");
export const metadata: Metadata = { title: area.label };

const NOTICES: Record<string, { tone: "ok" | "info"; text: string }> = {
  aceita: { tone: "ok", text: "Sugestão aceita e aplicada à atividade." },
  ajustada: { tone: "ok", text: "Sugestão ajustada e aplicada à atividade." },
  rejeitada: { tone: "info", text: "Sugestão rejeitada. Nenhuma atividade foi alterada." },
  reanalise: { tone: "info", text: "A análise voltou para a fila e será tentada no próximo ciclo (até 1 minuto)." },
};

const ANALYSIS_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" }> = {
  done: { label: "Analisado", tone: "ok" },
  pending: { label: "Análise de IA pendente", tone: "info" },
  running: { label: "Em análise", tone: "info" },
  waiting_registry: { label: "Aguardando o registro de atividades", tone: "neutral" },
  failed: { label: "Análise de IA falhou", tone: "danger" },
  disabled: { label: "Análise de IA desligada", tone: "warn" },
};

export default async function Page(props: PageProps<"/sugestoes">) {
  const query = await props.searchParams;
  const db = getDb();
  const members = listMembers();
  const persona = await getCurrentPersona();
  const memberNames = new Map(members.map((m) => [m.id, m.name]));
  const pending = listSuggestions(db, members, "pendente");
  const decided = listSuggestions(db, members, "decididas");
  const analyses = listAnalyses(db);
  const notice = typeof query.aviso === "string" ? NOTICES[query.aviso] : undefined;
  const canReview = persona?.canReview === true;

  return (
    <>
      <PageHeader title={area.label} description={area.description} />
      <StaleNote />
      {notice ? (
        <div className="mb-6">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}
      <div className="mb-6">
        <Notice tone="info" title="A IA só propõe.">
          Nada aqui muda uma atividade oficial até um revisor aceitar.{" "}
          {canReview
            ? `Você está como ${persona!.name}, que pode decidir.`
            : persona
              ? `Você está como ${persona.name}, que não é revisor(a): pode ver as sugestões, mas não decidir. Revisores: ${members.filter((m) => m.canReview).map((m) => m.name).join(" e ")}.`
              : "Escolha uma persona no topo da página. Só revisores decidem."}{" "}
          <Link href="/como-decidimos" className="underline">
            Como o app decide
          </Link>
        </Notice>
      </div>

      <section aria-labelledby="pendentes" className="mb-10">
        <h2 id="pendentes" className="text-xl font-semibold">
          Aguardando revisão ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 rounded border border-[var(--line)] p-4">Nenhuma sugestão pendente.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {pending.map((s) => (
              <SuggestionCard key={s.id} s={s} memberNames={memberNames} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="documentos" className="mb-10">
        <h2 id="documentos" className="text-xl font-semibold">
          Documentos analisados pela IA
        </h2>
        {analyses.length === 0 ? (
          <p className="mt-3 rounded border border-[var(--line)] p-4">Nenhuma ata foi analisada ainda.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {analyses.map((a) => {
              const status = ANALYSIS_STATUS[a.status] ?? { label: a.status, tone: "neutral" as const };
              return (
                <li key={a.id} className="rounded border border-[var(--line)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/fontes/${encodeURIComponent(a.fileId)}`} className="font-semibold text-[var(--lia-blue)] underline underline-offset-2">
                      {a.fileName}
                    </Link>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    {a.finishedAt ? <span className="text-sm text-[var(--ink-muted)]">{formatDateTimeBR(a.finishedAt)}</span> : null}
                  </div>
                  {a.summary ? <p className="mt-2">{a.summary}</p> : null}
                  {a.errorMessage ? <p className="mt-2 text-[var(--danger-ink)]">{a.errorMessage}</p> : null}
                  {a.noAction.length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">Trechos sem ação ({a.noAction.length})</summary>
                      <ul className="mt-1 list-disc pl-5 text-sm">
                        {a.noAction.map((n, i) => (
                          <li key={i}>
                            <em>“{displayQuote(n.evidence)}”</em> — {n.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {a.invalidCount > 0 ? (
                    <p className="mt-2 text-sm text-[var(--ink-muted)]">{a.invalidCount} item(ns) da IA foram descartados pela validação (sem evidência confiável).</p>
                  ) : null}
                  {a.status === "failed" || a.status === "disabled" || a.status === "pending" ? (
                    <form action={retryAnalysisAction} className="mt-2">
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="rounded border border-[var(--line)] px-3 py-1 text-sm hover:border-[var(--lia-blue)]">
                        Tentar novamente
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section aria-labelledby="decididas">
          <h2 id="decididas" className="text-xl font-semibold">
            Já decididas ({decided.length})
          </h2>
          <ul className="mt-3 grid gap-3">
            {decided.map((s) => (
              <SuggestionCard key={s.id} s={s} memberNames={memberNames} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const STATUS_LABEL: Record<SuggestionView["status"], { label: string; tone: "ok" | "warn" | "danger" | "info" | "neutral" }> = {
  pendente: { label: "Pendente", tone: "info" },
  aceita: { label: "Aceita", tone: "ok" },
  ajustada: { label: "Ajustada e aceita", tone: "ok" },
  rejeitada: { label: "Rejeitada", tone: "neutral" },
  substituida: { label: "Substituída por nova versão da fonte", tone: "neutral" },
};

function SuggestionCard({ s, memberNames }: { s: SuggestionView; memberNames: ReadonlyMap<string, string> }) {
  const status = STATUS_LABEL[s.status];
  return (
    <li className="rounded-md border border-[var(--line)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          <Link href={`/sugestoes/${s.id}`} className="underline-offset-2 hover:underline">
            {s.kind === "create" ? "Criar atividade" : `Atualizar ${s.target?.id ?? "atividade"}`}
            {s.target ? ` · ${s.target.title}` : ""}
          </Link>
        </h3>
        <span className="flex flex-wrap items-center gap-2">
          {s.stale ? <StatusBadge tone="warn">Fonte alterada — revisar</StatusBadge> : null}
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </span>
      </div>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        Fonte: {s.sourceName}
        {s.docDate ? ` · reunião de ${formatDateBR(s.docDate)}` : ""}
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {s.fields.map((f) => (
          <li key={f.field}>
            {SUGGESTION_FIELD_LABEL[f.field] ?? f.field}: {s.kind === "update" ? `${formatFieldValue(f.field, f.current, memberNames)} → ` : ""}
            <strong>{formatFieldValue(f.field, f.adjusted && f.final !== null ? f.final : f.proposed, memberNames)}</strong>
            {f.uncertain ? " (incerto)" : ""}
          </li>
        ))}
      </ul>
      {s.evidence[0] ? (
        <blockquote className="mt-2 border-l-4 border-[var(--line)] pl-3 text-sm italic">“{displayQuote(s.evidence[0].quote)}”</blockquote>
      ) : null}
      {s.uncertainties.length > 0 ? <p className="mt-2 text-sm">{s.uncertainties.length} ponto(s) a confirmar.</p> : null}
      {s.reviewerName ? (
        <p className="mt-2 text-sm">
          Decidida por {s.reviewerName}
          {s.reviewedAt ? ` em ${formatDateTimeBR(s.reviewedAt)}` : ""}
          {s.reviewReason ? ` · motivo: ${s.reviewReason}` : ""}
        </p>
      ) : null}
      <p className="mt-2">
        <Link href={`/sugestoes/${s.id}`} className="text-[var(--lia-blue)] underline underline-offset-2">
          {s.status === "pendente" ? "Revisar" : "Ver detalhes"}
        </Link>
      </p>
    </li>
  );
}
