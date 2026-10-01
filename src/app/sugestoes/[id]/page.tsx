import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SuggestionReviewForm, type ReviewField } from "@/components/suggestion-review-form";
import { formatDateBR, formatDateTimeBR } from "@/lib/datetime";
import { displayQuote, formatFieldValue, SUGGESTION_FIELD_LABEL } from "@/lib/field-format";
import { getSuggestion } from "@/server/ai/suggestion-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

export const metadata: Metadata = { title: "Revisar sugestão" };

const FORM_KEY: Record<string, ReviewField["key"]> = {
  title: "title",
  owners: "ownerIds",
  due_date: "dueDate",
  next_step: "nextStep",
  front: "front",
  status: "status",
};

export default async function Page(props: PageProps<"/sugestoes/[id]">) {
  const { id } = await props.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();
  const members = listMembers();
  const suggestion = getSuggestion(getDb(), members, numericId);
  if (!suggestion) notFound();
  const persona = await getCurrentPersona();
  const memberNames = new Map(members.map((m) => [m.id, m.name]));
  const open = suggestion.status === "pendente" && !suggestion.stale;
  const canReview = persona?.canReview === true;
  const reviewFields: ReviewField[] = suggestion.fields.flatMap((f) => {
    const key = FORM_KEY[f.field];
    if (!key) return [];
    const proposed = f.proposed;
    return [{ key, label: SUGGESTION_FIELD_LABEL[f.field] ?? f.field, proposed: (Array.isArray(proposed) ? proposed : String(proposed ?? "")) as string | string[] }];
  });

  return (
    <>
      <PageHeader
        title={suggestion.kind === "create" ? "Sugestão: criar atividade" : `Sugestão: atualizar ${suggestion.target?.id ?? ""}`}
        description={suggestion.target ? suggestion.target.title : undefined}
      >
        <p className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge tone={suggestion.status === "pendente" ? "info" : suggestion.status === "rejeitada" || suggestion.status === "substituida" ? "neutral" : "ok"}>
            {suggestion.status === "pendente" ? "Pendente" : suggestion.status === "aceita" ? "Aceita" : suggestion.status === "ajustada" ? "Ajustada e aceita" : suggestion.status === "rejeitada" ? "Rejeitada" : "Substituída"}
          </StatusBadge>
          {suggestion.stale ? <StatusBadge tone="warn">Fonte alterada — aguarde a nova análise</StatusBadge> : null}
          <Link href="/sugestoes" className="text-[var(--primary)] underline underline-offset-2">
            Voltar à fila
          </Link>
        </p>
      </PageHeader>

      <div className="mb-6">
        <Notice tone="info" title="Proposta da IA, não decisão.">
          O valor oficial da atividade só muda se um revisor aceitar. Confira o trecho da fonte antes de decidir.
        </Notice>
      </div>

      <section aria-labelledby="evidencia" className="mb-8">
        <h2 id="evidencia" className="text-xl font-semibold">
          Evidência na fonte
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {suggestion.sourceUrl?.startsWith("https://") ? (
            <a href={suggestion.sourceUrl} className="text-[var(--primary)] underline underline-offset-2">
              {suggestion.sourceName} (abrir no Drive)
            </a>
          ) : (
            suggestion.sourceName
          )}
          {suggestion.docDate ? ` · reunião de ${formatDateBR(suggestion.docDate)}` : ""}
        </p>
        <ul className="mt-2 grid gap-2">
          {suggestion.evidence.map((e, i) => (
            <li key={i}>
              <blockquote className="border-l-4 border-[var(--border)] pl-3 italic">“{displayQuote(e.quote)}”</blockquote>
              {e.locator ? <p className="pl-3 text-sm text-[var(--text-muted)]">{e.locator}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mudancas" className="mb-8">
        <h2 id="mudancas" className="text-xl font-semibold">
          {suggestion.kind === "update" ? "O que muda (atual → proposto)" : "Atividade proposta"}
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          {suggestion.fields.map((f) => (
            <div key={f.field} className="contents">
              <dt className="text-[var(--text-muted)]">{SUGGESTION_FIELD_LABEL[f.field] ?? f.field}</dt>
              <dd>
                {suggestion.kind === "update" ? `${formatFieldValue(f.field, f.current, memberNames)} → ` : ""}
                <strong>{formatFieldValue(f.field, f.proposed, memberNames)}</strong>
                {f.uncertain ? " (incerto — confirmar)" : ""}
                {f.adjusted ? ` · ajustado pelo revisor para ${formatFieldValue(f.field, f.final, memberNames)}` : ""}
              </dd>
            </div>
          ))}
          {suggestion.target?.front ? (
            <div className="contents">
              <dt className="text-[var(--text-muted)]">Frente da atividade</dt>
              <dd>{suggestion.target.front}</dd>
            </div>
          ) : null}
        </dl>
        {suggestion.rationale ? <p className="mt-3">Motivo: {suggestion.rationale}</p> : null}
        {suggestion.uncertainties.length > 0 ? (
          <div className="mt-3">
            <h3 className="font-semibold">Incertezas a confirmar</h3>
            <ul className="mt-1 list-disc pl-5">
              {suggestion.uncertainties.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="decisao">
        <h2 id="decisao" className="text-xl font-semibold">
          Decisão
        </h2>
        {suggestion.status !== "pendente" ? (
          <p className="mt-2">
            {suggestion.status === "substituida"
              ? "Esta sugestão foi substituída por uma análise mais nova da fonte."
              : `Decidida por ${suggestion.reviewerName ?? "—"}${suggestion.reviewedAt ? ` em ${formatDateTimeBR(suggestion.reviewedAt)}` : ""}.`}
            {suggestion.reviewReason ? ` Motivo: ${suggestion.reviewReason}.` : ""}{" "}
            {suggestion.createdActivityId ? (
              <Link href={`/atividades/${encodeURIComponent(suggestion.createdActivityId)}`} className="text-[var(--primary)] underline underline-offset-2">
                Ver a atividade criada
              </Link>
            ) : suggestion.target ? (
              <Link href={`/atividades/${encodeURIComponent(suggestion.target.id)}`} className="text-[var(--primary)] underline underline-offset-2">
                Ver a atividade
              </Link>
            ) : null}
          </p>
        ) : !open ? (
          <p className="mt-2">A fonte foi alterada depois desta sugestão. Aguarde a nova análise (em até 1 minuto) para decidir sobre a versão atual.</p>
        ) : !canReview ? (
          <p className="mt-2">
            {persona
              ? `Você está como ${persona.name}, que não é revisor(a). Você pode ver a sugestão, mas aceitar, ajustar e rejeitar estão disponíveis só para ${members.filter((m) => m.canReview).map((m) => m.name).join(" e ")}.`
              : "Escolha uma persona de revisor(a) no topo da página para decidir."}
          </p>
        ) : (
          <div className="mt-3">
            <SuggestionReviewForm id={suggestion.id} fields={reviewFields} members={members.map((m) => ({ id: m.id, name: m.name }))} />
          </div>
        )}
      </section>
    </>
  );
}
