import { ActivityCard } from "@/components/activity-card";
import type { ActivityView } from "@/server/activities/activity-queries";

export function ActivityList({ activities, today, empty }: { activities: ActivityView[]; today: string; empty: string }) {
  if (activities.length === 0) return <p className="rounded border border-[var(--line)] p-4">{empty}</p>;
  return (
    <ul className="grid gap-3">
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} today={today} />
      ))}
    </ul>
  );
}
