import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SuggestionReviewForm, type ReviewField } from "@/components/suggestion-review-form";
import { Card } from "@/components/ui/card";
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

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aceita: "Aceita",
  ajustada: "Ajustada e aceita",
  rejeitada: "Rejeitada",
  substituida: "Substituída",
};

const linkClass = "text-[var(--primary)] underline underline-offset-2";

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
  const isUpdate = suggestion.kind === "update";
  const reviewFields: ReviewField[] = suggestion.fields.flatMap((f) => {
    const key = FORM_KEY[f.field];
    if (!key) return [];
    const proposed = f.proposed;
    return [{ key, label: SUGGESTION_FIELD_LABEL[f.field] ?? f.field, proposed: (Array.isArray(proposed) ? proposed : String(proposed ?? "")) as string | string[] }];
  });
  const reviewers = members.filter((m) => m.canReview).map((m) => m.name).join(" e ");

  return (
    <>
      <PageHeader
        title={suggestion.kind === "create" ? "Criar atividade" : `Atualizar ${suggestion.target?.id ?? ""}`}
        description={suggestion.target ? suggestion.target.title : undefined}
        actions={
          <Link href="/sugestoes" className={`text-sm ${linkClass}`}>
            Voltar à fila
          </Link>
        }
      >
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone={suggestion.status === "pendente" ? "info" : suggestion.status === "rejeitada" || suggestion.status === "substituida" ? "neutral" : "ok"}>
            {STATUS_LABEL[suggestion.status] ?? suggestion.status}
          </StatusBadge>
          {suggestion.stale ? <StatusBadge tone="warn">Fonte alterada — aguarde a nova análise</StatusBadge> : null}
          <span className="text-sm text-[var(--text-muted)]">Proposta da IA: o valor oficial só muda se um revisor aceitar.</span>
        </p>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <Card className="p-5">
            <h2 id="mudancas" className="text-base font-semibold">
              {isUpdate ? "O que muda" : "Atividade proposta"}
            </h2>
            <table className="mt-3 w-full text-left text-sm">
              <caption className="sr-only">Campos propostos pela IA{isUpdate ? ", com o valor atual e o proposto" : ""}</caption>
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Campo
                  </th>
                  {isUpdate ? (
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Atual
                    </th>
                  ) : null}
                  <th scope="col" className="py-2 font-medium">
                    Proposto
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestion.fields.map((f) => (
                  <tr key={f.field} className="border-b border-[var(--border)] align-top last:border-0">
                    <th scope="row" className="py-2 pr-4 font-medium">
                      {SUGGESTION_FIELD_LABEL[f.field] ?? f.field}
                    </th>
                    {isUpdate ? <td className="py-2 pr-4 text-[var(--text-muted)]">{formatFieldValue(f.field, f.current, memberNames)}</td> : null}
                    <td className="py-2 font-medium">
                      {formatFieldValue(f.field, f.proposed, memberNames)}
                      {f.uncertain ? <span className="ml-1 font-normal text-[var(--warning-ink)]">(incerto — confirmar)</span> : null}
                      {f.adjusted ? (
                        <span className="block font-normal text-[var(--text-muted)]">ajustado pelo revisor para {formatFieldValue(f.field, f.final, memberNames)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {suggestion.target?.front ? (
                  <tr className="align-top">
                    <th scope="row" className="py-2 pr-4 font-medium">
                      Frente da atividade
                    </th>
                    {isUpdate ? <td className="py-2 pr-4" /> : null}
                    <td className="py-2">{suggestion.target.front}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {suggestion.rationale ? (
              <p className="mt-3 text-sm">
                <span className="font-medium">Motivo: </span>
                {suggestion.rationale}
              </p>
            ) : null}
            {suggestion.uncertainties.length > 0 ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Incertezas a confirmar</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {suggestion.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 id="evidencia" className="text-base font-semibold">
              Evidência na fonte
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {suggestion.sourceUrl?.startsWith("https://") ? (
                <a href={suggestion.sourceUrl} className={linkClass}>
                  {suggestion.sourceName} (abrir no Drive)
                </a>
              ) : (
                suggestion.sourceName
              )}
              {suggestion.docDate ? ` · reunião de ${formatDateBR(suggestion.docDate)}` : ""}
            </p>
            <ul className="mt-3 grid gap-3">
              {suggestion.evidence.map((e, i) => (
                <li key={i}>
                  <blockquote className="border-l-4 border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2">“{displayQuote(e.quote)}”</blockquote>
                  {e.locator ? <p className="mt-1 text-xs text-[var(--text-muted)]">{e.locator}</p> : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside aria-labelledby="decisao" className="lg:sticky lg:top-4">
          <Card className="p-5">
            <h2 id="decisao" className="text-base font-semibold">
              Decisão
            </h2>
            {suggestion.status !== "pendente" ? (
              <p className="mt-2 text-sm">
                {suggestion.status === "substituida"
                  ? "Esta sugestão foi substituída por uma análise mais nova da fonte."
                  : `Decidida por ${suggestion.reviewerName ?? "—"}${suggestion.reviewedAt ? ` em ${formatDateTimeBR(suggestion.reviewedAt)}` : ""}.`}
                {suggestion.reviewReason ? ` Motivo: ${suggestion.reviewReason}.` : ""}{" "}
                {suggestion.createdActivityId ? (
                  <Link href={`/atividades/${encodeURIComponent(suggestion.createdActivityId)}`} className={linkClass}>
                    Ver a atividade criada
                  </Link>
                ) : suggestion.target ? (
                  <Link href={`/atividades/${encodeURIComponent(suggestion.target.id)}`} className={linkClass}>
                    Ver a atividade
                  </Link>
                ) : null}
              </p>
            ) : !open ? (
              <p className="mt-2 text-sm">A fonte foi alterada depois desta sugestão. Aguarde a nova análise (em até 1 minuto) para decidir sobre a versão atual.</p>
            ) : !canReview ? (
              <p className="mt-2 text-sm">
                {persona
                  ? `Você está como ${persona.name}, que não é revisor(a). Você pode ver a sugestão, mas aceitar, ajustar e rejeitar estão disponíveis só para ${reviewers}.`
                  : "Escolha uma persona de revisor(a) no topo da página para decidir."}
              </p>
            ) : (
              <div className="mt-3">
                <SuggestionReviewForm id={suggestion.id} fields={reviewFields} members={members.map((m) => ({ id: m.id, name: m.name }))} />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
