import type { ActivityView } from "@/server/activities/activity-queries";

export interface PendingChange {
  suggestionId: number;
  field: string;
  value: unknown;
  sourceFileId: string;
}

export interface FieldConflict {
  field: string;
  values: PendingChange[];
}

export interface ResolvedActivity {
  /** Valor oficial: nunca é alterado por propostas pendentes (ADR-12). */
  official: ActivityView;
  pending: PendingChange[];
  /** Duas ou mais propostas pendentes com valores diferentes para o mesmo campo. */
  conflicts: FieldConflict[];
  staleness: "fresh" | "possibly_stale";
}

/**
 * Função pura (ADR-12): a tabela `activities` guarda só o valor oficial; propostas
 * pendentes viram aviso e conflito derivado, nunca escrita. As propostas chegam com a
 * Fase 6; até lá a lista é vazia e o resultado é só o oficial.
 */
export function resolvePrecedence(official: ActivityView, pending: readonly PendingChange[], stale: boolean): ResolvedActivity {
  const byField = new Map<string, PendingChange[]>();
  for (const change of pending) byField.set(change.field, [...(byField.get(change.field) ?? []), change]);
  const conflicts: FieldConflict[] = [];
  for (const [field, changes] of byField) {
    const distinct = new Set(changes.map((c) => JSON.stringify(c.value)));
    if (distinct.size > 1) conflicts.push({ field, values: changes });
  }
  return { official, pending: [...pending], conflicts, staleness: stale ? "possibly_stale" : "fresh" };
}
