import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isoDateInSaoPaulo } from "@/lib/datetime";
import { filterActivities, listActivityViews, sortByDue } from "@/server/activities/activity-queries";
import { getDb } from "@/server/db";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

const LATER = 3;
const link = "text-[var(--primary)] underline underline-offset-2";

export default async function Home() {
  const persona = await getCurrentPersona();
  const today = isoDateInSaoPaulo(new Date());
  const mine = persona
    ? sortByDue(filterActivities(listActivityViews(getDb(), listMembers()), { ownerId: persona.id, openOnly: true }, today))
    : [];
  const [next, ...rest] = mine;
  return (
    <>
      <PageHeader
        title={persona ? `Olá, ${persona.name}` : "Central da Liga IA"}
        description={
          persona
            ? "O que fazer agora e o que mudou desde a sua última visita."
            : "Atividades da Liga, sugestões da IA e novidades dos documentos, num só lugar."
        }
      />

      {!persona ? (
        <EmptyState
          title="Escolha quem você é para ver o que é seu"
          action={
            <ButtonLink href="/comece-aqui" variant="primary">
              Começar pelo guia
            </ButtonLink>
          }
        >
          Use “Trocar para” no topo da página. Primeira vez por aqui? O guia explica a Liga em quatro passos.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="proxima" className="mb-8">
            <h2 id="proxima" className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Sua próxima ação
            </h2>
            <ActivityList activities={next ? [next] : []} today={today} empty="Você não tem atividades abertas atribuídas." />
          </section>
          {rest.length > 0 ? (
            <section aria-labelledby="depois" className="mb-8">
              <h2 id="depois" className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Em seguida
              </h2>
              <ActivityList activities={rest.slice(0, LATER)} today={today} empty="" />
              {rest.length > LATER ? (
                <p className="mt-3 text-sm">
                  <Link href="/minhas-atividades" className={link}>
                    Ver as {mine.length} atividades abertas
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}
          <p className="text-sm text-[var(--text-muted)]">
            Primeiro acesso?{" "}
            <Link href="/comece-aqui" className={link}>
              Comece aqui
            </Link>{" "}
            · Dúvidas sobre qual valor vale?{" "}
            <Link href="/como-decidimos" className={link}>
              Como o app decide
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}
