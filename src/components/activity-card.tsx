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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Tudo de F5.1 na própria linha: título, responsáveis, frente, estado, prazo, próximo passo e fonte. */
export function ActivityCard({ activity, today }: { activity: ActivityView; today: string }) {
  const status = ACTIVITY_STATUS[activity.status ?? "a_confirmar"];
  const blocked = activity.status === "bloqueada";
  return (
    <li
      className={`rounded-lg border bg-[var(--surface)] px-4 py-3 ${
        blocked ? "border-[var(--border)] border-l-4 border-l-[var(--error-ink)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold leading-snug">
          <Link href={`/atividades/${encodeURIComponent(activity.id)}`} className="underline-offset-2 hover:underline">
            <span className="mr-1.5 font-mono text-sm font-medium text-[var(--text-muted)]">{activity.id}</span>
            {activity.title}
          </Link>
        </h3>
        <span className="flex flex-wrap items-center gap-1.5">
          {activity.pendingSuggestions > 0 ? <StatusBadge tone="info">Atualização pendente</StatusBadge> : null}
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </span>
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Meta label="Responsável">
          {activity.owners.length === 0
            ? "Sem responsável"
            : activity.owners.map((o, i) => (
                <span key={`${o.memberId ?? o.name}-${i}`}>
                  {i > 0 ? "; " : ""}
                  {o.memberId ? o.name : `responsável a confirmar ("${o.name}")`}
                </span>
              ))}
        </Meta>
        <Meta label="Prazo">
          <DueDate dueDate={activity.dueDate} today={today} />
        </Meta>
        <Meta label="Frente">{activity.front ?? "não informada"}</Meta>
      </dl>
      <p className="mt-2 text-sm">
        <span className="text-[var(--text-muted)]">Próximo passo: </span>
        {activity.nextStep ?? "não informado"}
      </p>
      {blocked && activity.notes ? (
        <p className="mt-1 text-sm">
          <strong className="font-semibold text-[var(--error-ink)]">Bloqueio: </strong>
          {activity.notes}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Fonte:{" "}
        {activity.sources.length === 0
          ? "sem fonte registrada"
          : activity.sources.map((s, i) => (
              <span key={`${s.fileId}-${s.relation}-${i}`}>
                {i > 0 ? " · " : ""}
                {RELATION_LABEL[s.relation] ?? s.relation}: <SourceRef source={s} />
              </span>
            ))}
      </p>
    </li>
  );
}
