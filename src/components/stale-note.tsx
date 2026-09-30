import { formatDateTimeBR } from "@/lib/datetime";
import { StatusBadge } from "@/components/status-badge";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { syncFreshness } from "@/server/sync/freshness";

/** Marca, ao lado das atividades, que os dados podem estar defasados do Drive (F3.6, CA-F3.6). */
export function StaleNote() {
  let fresh;
  try {
    fresh = syncFreshness(getDb(), getEnv().SYNC_INTERVAL_SECONDS, new Date());
  } catch {
    return null;
  }
  if (!fresh.stale || !fresh.lastOkAt) return null;
  return (
    <p className="mb-4">
      <StatusBadge tone="warn">Potencialmente desatualizado</StatusBadge>{" "}
      <span className="text-sm">
        Atividades conforme a última leitura do Drive, em {formatDateTimeBR(fresh.lastOkAt)}. As edições feitas aqui não dependem dela.
      </span>
    </p>
  );
}
