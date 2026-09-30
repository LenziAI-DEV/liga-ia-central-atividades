import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { PageHeader } from "@/components/page-header";
import { getArea } from "@/lib/areas";
import { isoDateInSaoPaulo } from "@/lib/datetime";
import { ACTIVITY_STATUS } from "@/lib/labels";
import {
  distinctFronts,
  filterActivities,
  listActivityViews,
  sortByDue,
  type DueFilter,
  type StatusFilter,
} from "@/server/activities/activity-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

const area = getArea("/atividades");
export const metadata: Metadata = { title: area.label };

const DUE_OPTIONS: Array<[DueFilter, string]> = [
  ["vencido", "Vencidas"],
  ["semana", "Nos próximos 7 dias"],
  ["sem_prazo", "Sem prazo (a definir)"],
];
const STATUS_KEYS = Object.keys(ACTIVITY_STATUS) as StatusFilter[];

const pick = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : undefined);

export default async function Page(props: PageProps<"/atividades">) {
  const params = await props.searchParams;
  const members = listMembers();
  const persona = await getCurrentPersona();
  const all = listActivityViews(getDb(), members);
  const fronts = distinctFronts(all);
  const today = isoDateInSaoPaulo(new Date());

  // Valores vindos da URL só valem se existirem nas listas: o resto é ignorado.
  const wantsMine = pick(params.minhas) === "1" && persona !== null;
  const ownerParam = pick(params.responsavel);
  const ownerId = wantsMine ? persona!.id : members.some((m) => m.id === ownerParam) ? ownerParam : undefined;
  const frontParam = pick(params.frente);
  const front = fronts.includes(frontParam ?? "") ? frontParam : undefined;
  const statusParam = pick(params.estado);
  const status = STATUS_KEYS.find((s) => s === statusParam);
  const dueParam = pick(params.prazo);
  const due = DUE_OPTIONS.find(([key]) => key === dueParam)?.[0];

  const shown = sortByDue(filterActivities(all, { ownerId, front, status, due }, today));
  const filtered = Boolean(ownerId || front || status || due);

  return (
    <>
      <PageHeader title={area.label} description={area.description} />
      <form method="get" className="mb-4 grid gap-3 rounded-md border border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Responsável" name="responsavel" value={wantsMine ? undefined : ownerId}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Field>
        <Field label="Frente" name="frente" value={front}>
          {fronts.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Field>
        <Field label="Estado" name="estado" value={status}>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>
              {ACTIVITY_STATUS[s].label}
            </option>
          ))}
        </Field>
        <Field label="Prazo" name="prazo" value={due}>
          {DUE_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          {persona ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="minhas" value="1" defaultChecked={wantsMine} />
              Só as minhas ({persona.name})
            </label>
          ) : null}
          <button
            type="submit"
            className="rounded bg-[var(--lia-blue)] px-4 py-2 text-[var(--paper)] hover:bg-[var(--lia-blue-dark)]"
          >
            Filtrar
          </button>
          {filtered ? (
            <Link href="/atividades" className="py-2 text-[var(--lia-blue)] underline underline-offset-2">
              Limpar filtros
            </Link>
          ) : null}
        </div>
      </form>
      <p className="mb-4">
        {filtered ? `${shown.length} de ${all.length} atividade(s)` : `${all.length} atividade(s) no total`}
        {" "}(uma atividade com vários responsáveis conta uma vez).
      </p>
      <ActivityList
        heading="Atividades da Liga"
        activities={shown}
        today={today}
        empty={all.length === 0 ? "Ainda não há atividades importadas." : "Nenhuma atividade com esses filtros."}
      />
    </>
  );
}

function Field({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="rounded border border-[var(--line)] bg-[var(--paper)] px-2 py-2">
        <option value="">Todos</option>
        {children}
      </select>
    </label>
  );
}
