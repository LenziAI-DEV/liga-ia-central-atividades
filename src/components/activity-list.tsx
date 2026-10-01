import { ActivityCard } from "@/components/activity-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActivityView } from "@/server/activities/activity-queries";

export function ActivityList({
  activities,
  today,
  empty,
  heading,
}: {
  activities: ActivityView[];
  today: string;
  empty: string;
  /** Título de seção só para leitores de tela; evita pular do h1 direto para os h3 dos cartões. */
  heading?: string;
}) {
  if (activities.length === 0) return <EmptyState title={empty} />;
  return (
    <>
      {heading ? <h2 className="sr-only">{heading}</h2> : null}
      <ul className="grid gap-2">
        {activities.map((a) => (
          <ActivityCard key={a.id} activity={a} today={today} />
        ))}
      </ul>
    </>
  );
}
