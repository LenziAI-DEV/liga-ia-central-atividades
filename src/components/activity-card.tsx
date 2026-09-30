import Link from "next/link";
import { SourceRef } from "@/components/source-ref";
import { DueDate } from "@/components/due-date";
import { StatusBadge } from "@/components/status-badge";
import { ACTIVITY_STATUS } from "@/lib/labels";
import type { ActivityView } from "@/server/activities/activity-queries";

const RELATION_LABEL: Record<string, string> = {
  imported_from: "Registro",
  historical_origin: "Origem",
  updated_by: "Atualizada por",
  created_by: "Criada por",
};

/** Tudo de F5.1 na própria linha: título, responsáveis, frente, estado, prazo, próximo passo e fonte. */
export function ActivityCard({ activity, today }: { activity: ActivityView; today: string }) {
  const status = ACTIVITY_STATUS[activity.status ?? "a_confirmar"];
  const blocked = activity.status === "bloqueada";
  return (
    <li
      className={`rounded-md border p-4 ${blocked ? "border-l-4 border-[var(--danger-ink)]" : "border-[var(--line)]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">
          <Link href={`/atividades/${encodeURIComponent(activity.id)}`} className="underline-offset-2 hover:underline">
            <span className="text-[var(--ink-muted)]">{activity.id}</span> · {activity.title}
          </Link>
        </h3>
        <span className="flex flex-wrap items-center gap-2">
          {activity.pendingSuggestions > 0 ? <StatusBadge tone="info">Atualização pendente</StatusBadge> : null}
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-[var(--ink-muted)]">Responsável</dt>
        <dd>
          {activity.owners.length === 0
            ? "Sem responsável"
            : activity.owners.map((o, i) => (
                <span key={`${o.memberId ?? o.name}-${i}`}>
                  {i > 0 ? "; " : ""}
                  {o.memberId ? o.name : `responsável a confirmar ("${o.name}")`}
                </span>
              ))}
        </dd>
        <dt className="text-[var(--ink-muted)]">Prazo</dt>
        <dd>
          <DueDate dueDate={activity.dueDate} today={today} />
        </dd>
        <dt className="text-[var(--ink-muted)]">Frente</dt>
        <dd>{activity.front ?? "não informada"}</dd>
        <dt className="text-[var(--ink-muted)]">Próximo passo</dt>
        <dd>{activity.nextStep ?? "não informado"}</dd>
        {blocked && activity.notes ? (
          <>
            <dt className="font-semibold text-[var(--danger-ink)]">Bloqueio</dt>
            <dd>{activity.notes}</dd>
          </>
        ) : null}
        <dt className="text-[var(--ink-muted)]">Fonte</dt>
        <dd>
          {activity.sources.length === 0
            ? "sem fonte registrada"
            : activity.sources.map((s, i) => (
                <span key={`${s.fileId}-${s.relation}-${i}`}>
                  {i > 0 ? " · " : ""}
                  {RELATION_LABEL[s.relation] ?? s.relation}:{" "}
                  <SourceRef source={s} />
                </span>
              ))}
        </dd>
      </dl>
    </li>
  );
}
