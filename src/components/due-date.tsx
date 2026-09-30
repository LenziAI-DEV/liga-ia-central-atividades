import { StatusBadge } from "@/components/status-badge";
import { DUE_LABEL, dueState, formatDateBR } from "@/lib/datetime";

/** Prazo em texto: a data original nunca muda; "vencido" e "a definir" aparecem por escrito (F5.7). */
export function DueDate({ dueDate, today }: { dueDate: string | null; today: string }) {
  const state = dueState(dueDate, today);
  if (!dueDate) return <StatusBadge tone="warn">Prazo a definir</StatusBadge>;
  const tone = state === "vencido" ? "danger" : state === "hoje" || state === "proximo" ? "warn" : "neutral";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <time dateTime={dueDate}>{formatDateBR(dueDate)}</time>
      {state === "no_prazo" ? null : <StatusBadge tone={tone}>{DUE_LABEL[state]}</StatusBadge>}
    </span>
  );
}
