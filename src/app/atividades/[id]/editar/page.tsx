import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityForm } from "@/components/activity-form";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { distinctFronts, getActivityView, listActivityViews } from "@/server/activities/activity-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

export const metadata: Metadata = { title: "Editar atividade" };

export default async function Page(props: PageProps<"/atividades/[id]/editar">) {
  const { id } = await props.params;
  const members = listMembers();
  const db = getDb();
  const activity = getActivityView(db, members, id);
  if (!activity) notFound();
  const persona = await getCurrentPersona();
  const fronts = distinctFronts(listActivityViews(db, members));
  return (
    <>
      <PageHeader title={`Editar ${activity.id}`} description={activity.title} />
      {persona ? null : (
        <div className="mb-6">
          <Notice tone="warn">Escolha uma persona no topo da página: quem edita fica registrado no histórico.</Notice>
        </div>
      )}
      <ActivityForm
        members={members.map((m) => ({ id: m.id, name: m.name, front: m.front }))}
        fronts={fronts}
        initial={{
          id: activity.id,
          version: activity.version,
          unresolvedOwners: activity.owners.filter((o) => o.memberId === null).map((o) => o.name),
          values: {
            title: activity.title,
            description: activity.description ?? "",
            nextStep: activity.nextStep ?? "",
            front: activity.front ?? "",
            status: activity.status ?? "",
            dueDate: activity.dueDate ?? "",
            priority: activity.priority ?? "",
            notes: activity.notes ?? "",
            ownerIds: activity.owners.flatMap((o) => (o.memberId ? [o.memberId] : [])),
          },
        }}
        cancelHref={`/atividades/${encodeURIComponent(activity.id)}`}
      />
    </>
  );
}
