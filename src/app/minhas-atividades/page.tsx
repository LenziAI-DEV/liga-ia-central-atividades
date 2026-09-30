import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { getArea } from "@/lib/areas";
import { isoDateInSaoPaulo } from "@/lib/datetime";
import { filterActivities, listActivityViews, sortByDue } from "@/server/activities/activity-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

const area = getArea("/minhas-atividades");
export const metadata: Metadata = { title: area.label };

export default async function Page(props: PageProps<"/minhas-atividades">) {
  const params = await props.searchParams;
  const descending = params.ordem === "prazo-desc";
  const persona = await getCurrentPersona();
  if (!persona) {
    return (
      <>
        <PageHeader title={area.label} description={area.description} />
        <Notice tone="info">Escolha uma persona no topo da página para ver o que é seu.</Notice>
      </>
    );
  }

  const today = isoDateInSaoPaulo(new Date());
  const mine = filterActivities(listActivityViews(getDb(), listMembers()), { ownerId: persona.id, openOnly: true }, today);
  const sorted = sortByDue(mine);
  // "A definir" continua por último nas duas direções.
  const dated = sorted.filter((a) => a.dueDate !== null);
  const ordered = descending ? [...dated.reverse(), ...sorted.filter((a) => a.dueDate === null)] : sorted;
  const blocked = mine.filter((a) => a.status === "bloqueada").length;
  const undated = mine.filter((a) => a.dueDate === null).length;

  return (
    <>
      <PageHeader title={`Minhas atividades — ${persona.name}`} description={area.description} />
      <p className="mb-4" aria-live="polite">
        {mine.length === 0
          ? "Nenhuma atividade aberta atribuída a você."
          : `${mine.length} atividade(s) aberta(s), inclusive as compartilhadas`}
        {blocked > 0 ? ` · ${blocked} bloqueada(s)` : ""}
        {undated > 0 ? ` · ${undated} sem prazo` : ""}.{" "}
        <Link
          href={descending ? "/minhas-atividades" : "/minhas-atividades?ordem=prazo-desc"}
          className="text-[var(--lia-blue)] underline underline-offset-2"
        >
          {descending ? "Ordenar pelo prazo mais próximo" : "Ordenar pelo prazo mais distante"}
        </Link>
      </p>
      <ActivityList
        activities={ordered}
        today={today}
        empty="Você não tem atividades abertas. Veja “Todas as atividades” para o que a Liga está fazendo."
      />
    </>
  );
}
