import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { PageHeader } from "@/components/page-header";
import { AREAS } from "@/lib/areas";
import { isoDateInSaoPaulo } from "@/lib/datetime";
import { filterActivities, listActivityViews, sortByDue } from "@/server/activities/activity-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

const NEXT_UP = 3;

export default async function Home() {
  const persona = await getCurrentPersona();
  const today = isoDateInSaoPaulo(new Date());
  const mine = persona
    ? sortByDue(filterActivities(listActivityViews(getDb(), listMembers()), { ownerId: persona.id, openOnly: true }, today))
    : [];
  return (
    <>
      <PageHeader
        title="Central de contexto e atividades"
        description="Duas perguntas guiam esta central: o que preciso fazer agora? E o que mudou desde a última vez que acompanhei a Liga?"
      />
      <section aria-labelledby="proximas" className="mb-10">
        <h2 id="proximas" className="text-xl font-semibold">
          {persona ? `Próximas atividades de ${persona.name}` : "Suas próximas atividades"}
        </h2>
        <div className="mt-3">
          {persona ? (
            <>
              <ActivityList
                activities={mine.slice(0, NEXT_UP)}
                today={today}
                empty="Você não tem atividades abertas atribuídas."
              />
              {mine.length > NEXT_UP ? (
                <p className="mt-3">
                  <Link href="/minhas-atividades" className="text-[var(--lia-blue)] underline underline-offset-2">
                    Ver as {mine.length} atividades abertas
                  </Link>
                </p>
              ) : null}
            </>
          ) : (
            <p className="rounded border border-[var(--line)] p-4">
              Escolha uma persona no topo da página para ver o que é seu, com prazo e próximo passo.
            </p>
          )}
        </div>
      </section>
      <section aria-labelledby="areas-titulo">
        <h2 id="areas-titulo" className="text-xl font-semibold">
          Áreas da central
        </h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((area) => (
            <li key={area.href}>
              <Link
                href={area.href}
                className="block h-full rounded-md border border-[var(--line)] p-5 transition-colors hover:border-[var(--lia-blue)]"
              >
                <span className="block font-semibold text-[var(--lia-blue)]">{area.label}</span>
                <span className="mt-1 block text-sm text-[var(--ink-muted)]">{area.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
