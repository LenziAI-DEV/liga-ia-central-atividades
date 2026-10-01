import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DueDate } from "@/components/due-date";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { SourceRef } from "@/components/source-ref";
import { StaleNote } from "@/components/stale-note";
import { StatusBadge } from "@/components/status-badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CONTROL, Field } from "@/components/ui/field";
import { formatDateBR, formatDateTimeBR, isoDateInSaoPaulo } from "@/lib/datetime";
import { ACTIVITY_STATUS } from "@/lib/labels";
import { actorName, getActivityView, listEvents } from "@/server/activities/activity-queries";
import { resolvePrecedence } from "@/server/authority/precedence-resolver";
import { pendingChangesFor } from "@/server/ai/suggestion-queries";
import { formatFieldValue, SUGGESTION_FIELD_LABEL } from "@/lib/field-format";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";
import { quickStatusAction } from "../actions";

export const metadata: Metadata = { title: "Atividade" };

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  nextStep: "Próximo passo",
  front: "Frente",
  status: "Estado",
  dueDate: "Prazo",
  priority: "Prioridade",
  notes: "Notas e bloqueios",
  ownerIds: "Responsáveis",
  next_step: "Próximo passo",
  due_date: "Prazo",
  owners: "Responsáveis",
};

const KIND_LABEL: Record<string, string> = {
  created: "Criada",
  imported: "Importada do registro",
  updated: "Editada",
  suggestion_applied: "Sugestão aplicada",
  archived: "Arquivada",
};

const NOTICES: Record<string, { tone: "ok" | "warn" | "danger" | "info"; text: string }> = {
  criada: { tone: "ok", text: "Atividade criada." },
  salva: { tone: "ok", text: "Alterações salvas e registradas no histórico." },
  semmudanca: { tone: "info", text: "Nada mudou, então nada foi registrado." },
  conflito: {
    tone: "danger",
    text: "A atividade foi alterada por outra pessoa. Confira os dados abaixo e refaça a mudança.",
  },
  persona: { tone: "warn", text: "Escolha uma persona no topo da página antes de alterar." },
  invalido: { tone: "danger", text: "Pedido inválido. Nada foi alterado." },
  erro: { tone: "danger", text: "Não foi possível salvar. Nada foi alterado." },
};

function show(field: string, value: unknown, memberNames: Map<string, string>): string {
  if (field === "status" && (value === null || value === "")) return ACTIVITY_STATUS.a_confirmar.label;
  if (value === null || value === undefined || value === "") return "(vazio)";
  if (field === "status" && typeof value === "string") {
    return ACTIVITY_STATUS[value as keyof typeof ACTIVITY_STATUS]?.label ?? value;
  }
  if ((field === "dueDate" || field === "due_date") && typeof value === "string") return formatDateBR(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "(nenhum)" : value.map((v) => memberNames.get(String(v)) ?? String(v)).join("; ");
  }
  return String(value);
}

const SOURCE_RELATION_LABEL: Record<string, string> = {
  imported_from: "Registro importado",
  historical_origin: "Origem histórica",
  updated_by: "Atualizada por sugestão aceita",
  created_by: "Criada a partir de",
};

export default async function Page(props: PageProps<"/atividades/[id]">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const members = listMembers();
  const db = getDb();
  const activity = getActivityView(db, members, id);
  if (!activity) notFound();
  const persona = await getCurrentPersona();
  const events = listEvents(db, activity.id, members);
  const memberNames = new Map(members.map((m) => [m.id, m.name]));
  const today = isoDateInSaoPaulo(new Date());
  const changes = pendingChangesFor(db, activity.id);
  const { conflicts } = resolvePrecedence(activity, changes, false);
  const status = ACTIVITY_STATUS[activity.status ?? "a_confirmar"];
  const notice = typeof query.aviso === "string" ? NOTICES[query.aviso] : undefined;
  const done = activity.status === "concluida";
  const blocked = activity.status === "bloqueada";
  const hidden = (
    <>
      <input type="hidden" name="id" value={activity.id} />
      <input type="hidden" name="version" value={activity.version} />
    </>
  );

  return (
    <>
      <StaleNote />
      <PageHeader title={activity.title}>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-[var(--text-muted)]">{activity.id}</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {activity.origin === "manual" ? <StatusBadge tone="info">Criada manualmente</StatusBadge> : null}
          {activity.origin === "importada" ? <StatusBadge tone="neutral">Importada do registro</StatusBadge> : null}
        </p>
      </PageHeader>
      {conflicts.length > 0 ? (
        <div className="mb-6">
          <Notice tone="danger" title="Conflito — requer decisão:">
            Duas ou mais fontes propõem valores diferentes para o mesmo campo. O valor oficial não mudou até um revisor decidir.
            <ul className="mt-2 list-disc pl-5">
              {conflicts.map((c) => (
                <li key={c.field}>
                  {SUGGESTION_FIELD_LABEL[c.field] ?? c.field}:{" "}
                  {c.values.map((v, i) => {
                    const change = changes.find((x) => x.suggestionId === v.suggestionId && x.field === c.field)!;
                    return (
                      <span key={v.suggestionId}>
                        {i > 0 ? " × " : ""}
                        <Link href={`/sugestoes/${v.suggestionId}`} className="underline">
                          {formatFieldValue(c.field, v.value, memberNames)}
                        </Link>{" "}
                        (fonte: {change.sourceName})
                      </span>
                    );
                  })}
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : null}
      {activity.pendingSuggestions > 0 ? (
        <div className="mb-6">
          <Notice tone="info" title="Atualização pendente:">
            {activity.pendingSuggestions} sugestão(ões) da IA aguardando revisão. Os valores abaixo são os oficiais e não mudaram.{" "}
            <Link href="/sugestoes" className="underline">
              Ver sugestões
            </Link>
          </Notice>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-6">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          <Card className="p-5">
            <h2 id="dados" className="text-base font-semibold">
              Dados
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[max-content_1fr]">
              <Row label="Responsáveis">
                {activity.owners.length === 0
                  ? "Sem responsável"
                  : activity.owners.map((o) => (o.memberId ? o.name : `responsável a confirmar ("${o.name}")`)).join("; ")}
              </Row>
              <Row label="Prazo">
                <DueDate dueDate={activity.dueDate} today={today} />
              </Row>
              <Row label="Frente">{activity.front ?? "não informada"}</Row>
              <Row label="Prioridade">{activity.priority ?? "não informada"}</Row>
              <Row label="Próximo passo">{activity.nextStep ?? "não informado"}</Row>
              <Row label="Descrição">{activity.description ?? "sem descrição"}</Row>
              <Row label="Notas e bloqueios">{activity.notes ?? "sem notas"}</Row>
              <Row label="Criada">
                {formatDateTimeBR(activity.createdAt)} por {actorName(activity.createdBy, members)}
              </Row>
              <Row label="Última atualização">
                {formatDateTimeBR(activity.updatedAt)} por {actorName(activity.updatedBy, members)}
              </Row>
            </dl>
          </Card>

          <section aria-labelledby="historico">
            <h2 id="historico" className="mb-3 text-base font-semibold">
              Histórico
            </h2>
            <ol className="grid gap-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
                  <p>
                    <strong>{KIND_LABEL[e.kind] ?? e.kind}</strong> por {e.actor} em{" "}
                    <time dateTime={e.occurredAt} className="font-mono text-xs">
                      {formatDateTimeBR(e.occurredAt)}
                    </time>
                    {e.reason ? ` · motivo: ${e.reason}` : ""}
                  </p>
                  {e.changes.length > 0 ? (
                    <ul className="mt-1 grid gap-0.5 text-[var(--text-muted)]">
                      {e.changes.map((c, i) => (
                        <li key={`${c.field}-${i}`}>
                          {FIELD_LABEL[c.field] ?? c.field}: {show(c.field, c.before, memberNames)} → {" "}
                          <span className="text-[var(--text)]">{show(c.field, c.after, memberNames)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-4">
          <Card className="p-5">
            <h2 id="acoes" className="text-base font-semibold">
              Ações
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {persona
                ? `A alteração será registrada em nome de ${persona.name}.`
                : "Escolha uma persona no topo da página para alterar."}
            </p>
            <div className="mt-4 grid gap-3">
              {done ? (
                <form action={quickStatusAction}>
                  {hidden}
                  <input type="hidden" name="status" value="em_andamento" />
                  <Button type="submit" variant="secondary" className="w-full">
                    Reabrir (em andamento)
                  </Button>
                </form>
              ) : (
                <form action={quickStatusAction}>
                  {hidden}
                  <input type="hidden" name="status" value="concluida" />
                  <Button type="submit" className="w-full">
                    Concluir
                  </Button>
                </form>
              )}
              <ButtonLink href={`/atividades/${encodeURIComponent(activity.id)}/editar`} variant="secondary">
                Editar
              </ButtonLink>
              {blocked ? (
                <form action={quickStatusAction}>
                  {hidden}
                  <input type="hidden" name="status" value="em_andamento" />
                  <Button type="submit" variant="secondary" className="w-full">
                    Desbloquear (em andamento)
                  </Button>
                </form>
              ) : (
                <form action={quickStatusAction} className="grid gap-2 border-t border-[var(--border)] pt-3">
                  {hidden}
                  <input type="hidden" name="status" value="bloqueada" />
                  <Field label="Motivo do bloqueio" hint="Opcional; vira as notas.">
                    <input name="reason" maxLength={2000} className={CONTROL} />
                  </Field>
                  <Button type="submit" variant="danger">
                    Bloquear
                  </Button>
                </form>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 id="fontes" className="text-base font-semibold">
              Fontes
            </h2>
            {activity.sources.length === 0 ? (
              <p className="mt-2 text-sm">Sem fonte registrada: atividade criada pela interface.</p>
            ) : (
              <ul className="mt-2 grid gap-2 text-sm">
                {activity.sources.map((s, i) => (
                  <li key={`${s.fileId}-${s.relation}-${i}`}>
                    <span className="block text-xs text-[var(--text-muted)]">{SOURCE_RELATION_LABEL[s.relation] ?? s.relation}</span>
                    <SourceRef source={s} />
                    {s.locator ? ` (${s.locator})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
