import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DueDate } from "@/components/due-date";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { SourceRef } from "@/components/source-ref";
import { StaleNote } from "@/components/stale-note";
import { StatusBadge } from "@/components/status-badge";
import { formatDateBR, formatDateTimeBR, isoDateInSaoPaulo } from "@/lib/datetime";
import { ACTIVITY_STATUS } from "@/lib/labels";
import { actorName, getActivityView, listEvents } from "@/server/activities/activity-queries";
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

const BUTTON = "rounded border border-[var(--line)] px-4 py-2 hover:border-[var(--lia-blue)]";

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
      <PageHeader title={`${activity.id} · ${activity.title}`}>
        <p className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {activity.origin === "manual" ? <StatusBadge tone="info">Criada manualmente</StatusBadge> : null}
          {activity.origin === "importada" ? <StatusBadge tone="neutral">Importada do registro</StatusBadge> : null}
        </p>
      </PageHeader>
      {notice ? (
        <div className="mb-6">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      <section aria-labelledby="dados" className="mb-8">
        <h2 id="dados" className="text-xl font-semibold">
          Dados
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          <dt className="text-[var(--ink-muted)]">Responsáveis</dt>
          <dd>
            {activity.owners.length === 0
              ? "Sem responsável"
              : activity.owners.map((o) => (o.memberId ? o.name : `responsável a confirmar ("${o.name}")`)).join("; ")}
          </dd>
          <dt className="text-[var(--ink-muted)]">Prazo</dt>
          <dd>
            <DueDate dueDate={activity.dueDate} today={today} />
          </dd>
          <dt className="text-[var(--ink-muted)]">Frente</dt>
          <dd>{activity.front ?? "não informada"}</dd>
          <dt className="text-[var(--ink-muted)]">Prioridade</dt>
          <dd>{activity.priority ?? "não informada"}</dd>
          <dt className="text-[var(--ink-muted)]">Próximo passo</dt>
          <dd>{activity.nextStep ?? "não informado"}</dd>
          <dt className="text-[var(--ink-muted)]">Descrição</dt>
          <dd>{activity.description ?? "sem descrição"}</dd>
          <dt className="text-[var(--ink-muted)]">Notas e bloqueios</dt>
          <dd>{activity.notes ?? "sem notas"}</dd>
          <dt className="text-[var(--ink-muted)]">Criada</dt>
          <dd>
            {formatDateTimeBR(activity.createdAt)} por {actorName(activity.createdBy, members)}
          </dd>
          <dt className="text-[var(--ink-muted)]">Última atualização</dt>
          <dd>
            {formatDateTimeBR(activity.updatedAt)} por {actorName(activity.updatedBy, members)}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="acoes" className="mb-8">
        <h2 id="acoes" className="text-xl font-semibold">
          Ações
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          {persona
            ? `A alteração será registrada em nome de ${persona.name}.`
            : "Escolha uma persona no topo da página para alterar."}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-4">
          <Link href={`/atividades/${encodeURIComponent(activity.id)}/editar`} className={BUTTON}>
            Editar
          </Link>
          {done ? (
            <form action={quickStatusAction}>
              {hidden}
              <input type="hidden" name="status" value="em_andamento" />
              <button type="submit" className={BUTTON}>
                Reabrir (em andamento)
              </button>
            </form>
          ) : (
            <form action={quickStatusAction}>
              {hidden}
              <input type="hidden" name="status" value="concluida" />
              <button
                type="submit"
                className="rounded bg-[var(--lia-blue)] px-4 py-2 text-[var(--paper)] hover:bg-[var(--lia-blue-dark)]"
              >
                Concluir
              </button>
            </form>
          )}
          {blocked ? (
            <form action={quickStatusAction}>
              {hidden}
              <input type="hidden" name="status" value="em_andamento" />
              <button type="submit" className={BUTTON}>
                Desbloquear (em andamento)
              </button>
            </form>
          ) : (
            <form action={quickStatusAction} className="flex flex-wrap items-end gap-2">
              {hidden}
              <input type="hidden" name="status" value="bloqueada" />
              <label className="grid gap-1 text-sm">
                Motivo do bloqueio (opcional)
                <input name="reason" maxLength={2000} className="rounded border border-[var(--line)] px-3 py-2" />
              </label>
              <button type="submit" className="rounded border border-[var(--danger-ink)] px-4 py-2 text-[var(--danger-ink)]">
                Bloquear
              </button>
            </form>
          )}
        </div>
      </section>

      <section aria-labelledby="fontes" className="mb-8">
        <h2 id="fontes" className="text-xl font-semibold">
          Fontes
        </h2>
        {activity.sources.length === 0 ? (
          <p className="mt-2">Sem fonte registrada: atividade criada pela interface.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5">
            {activity.sources.map((s, i) => (
              <li key={`${s.fileId}-${s.relation}-${i}`}>
                {s.relation === "historical_origin" ? "Origem histórica" : "Registro importado"}:{" "}
                <SourceRef source={s} />
                {s.locator ? ` (${s.locator})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="historico">
        <h2 id="historico" className="text-xl font-semibold">
          Histórico
        </h2>
        <ol className="mt-3 grid gap-3">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-[var(--line)] p-3">
              <p>
                <strong>{KIND_LABEL[e.kind] ?? e.kind}</strong> por {e.actor} em{" "}
                <time dateTime={e.occurredAt}>{formatDateTimeBR(e.occurredAt)}</time>
                {e.reason ? ` · motivo: ${e.reason}` : ""}
              </p>
              {e.changes.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {e.changes.map((c, i) => (
                    <li key={`${c.field}-${i}`}>
                      {FIELD_LABEL[c.field] ?? c.field}: {show(c.field, c.before, memberNames)} →{" "}
                      {show(c.field, c.after, memberNames)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
