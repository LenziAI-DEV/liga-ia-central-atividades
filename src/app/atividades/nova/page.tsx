import type { Metadata } from "next";
import { ActivityForm } from "@/components/activity-form";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { distinctFronts, listActivityViews } from "@/server/activities/activity-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

export const metadata: Metadata = { title: "Nova atividade" };

export default async function Page() {
  const persona = await getCurrentPersona();
  const members = listMembers();
  const fronts = distinctFronts(listActivityViews(getDb(), members));
  return (
    <>
      <PageHeader
        title="Nova atividade"
        description="Ela recebe um ID, o seu nome como autor, o horário e a marca “criada manualmente”."
      />
      {persona ? null : (
        <div className="mb-6">
          <Notice tone="warn">Escolha uma persona no topo da página: o autor da atividade fica registrado.</Notice>
        </div>
      )}
      <ActivityForm
        members={members.map((m) => ({ id: m.id, name: m.name, front: m.front }))}
        fronts={fronts}
        initial={{ values: { status: "a_fazer", front: persona?.front ?? "", ownerIds: persona ? [persona.id] : [] } }}
        cancelHref="/atividades"
      />
    </>
  );
}
