import { isValidIsoDate } from "@/lib/datetime";
import type { Db } from "@/server/db/client";

/** Dentro desta janela, abrir de novo a página conta como a mesma visita (recarregar não zera o resumo). */
export const SAME_VISIT_MS = 2 * 60 * 1000;

export type MarkerKind = "visita" | "carga" | "periodo";

export interface Marker {
  /** Instante ISO (UTC) a partir do qual se procura mudança. */
  since: string;
  kind: MarkerKind;
  label: string;
}

export interface VisitRow {
  last_visit_at: string;
  previous_visit_at: string | null;
}

export function getVisit(db: Db, memberId: string): VisitRow | undefined {
  return db.get<VisitRow>("SELECT last_visit_at, previous_visit_at FROM persona_visits WHERE member_id = ?", memberId);
}

/** Início da carga inicial (primeira sincronização): marco da primeira visita (DN-10). */
export function loadStartAt(db: Db, fallback: string): string {
  const run = db.get<{ t: string | null }>("SELECT MIN(started_at) AS t FROM sync_runs");
  if (run?.t) return run.t;
  const source = db.get<{ t: string | null }>("SELECT MIN(first_seen_at) AS t FROM sources");
  return source?.t ?? fallback;
}

/** Fim da carga inicial (primeira sincronização terminada, senão o início dela). */
export function initialLoadEndAt(db: Db, fallback: string): string {
  const run = db.get<{ t: string | null }>(
    "SELECT COALESCE(finished_at, started_at) AS t FROM sync_runs ORDER BY id LIMIT 1",
  );
  return run?.t ?? fallback;
}

/**
 * Registra a abertura da página. Visitas dentro da janela de "mesma visita" só movem a última
 * visita; o marco anterior fica, para o resumo continuar igual ao recarregar.
 */
export function recordVisit(db: Db, memberId: string, now: Date): void {
  const at = now.toISOString();
  const current = getVisit(db, memberId);
  if (!current) {
    db.run("INSERT INTO persona_visits (member_id, last_visit_at, previous_visit_at) VALUES (?, ?, NULL)", memberId, at);
    return;
  }
  const recent = now.getTime() - Date.parse(current.last_visit_at) < SAME_VISIT_MS;
  if (recent) db.run("UPDATE persona_visits SET last_visit_at = ? WHERE member_id = ?", at, memberId);
  else
    db.run(
      "UPDATE persona_visits SET previous_visit_at = last_visit_at, last_visit_at = ? WHERE member_id = ?",
      at,
      memberId,
    );
}

/** Meia-noite de um dia civil em São Paulo (UTC-3, sem horário de verão desde 2019), em ISO UTC. */
export function startOfDaySaoPaulo(isoDate: string): string {
  return `${isoDate}T03:00:00.000Z`;
}

export interface ResolveInput {
  /** Valor de `?desde=`: `24h`, `7d`, `carga` ou `AAAA-MM-DD`. Qualquer outro valor é ignorado. */
  param: string | undefined;
  visit: VisitRow | undefined;
  loadStart: string;
  now: Date;
}

/** Decide o marco do resumo. Lê a visita anterior, portanto deve rodar antes de `recordVisit`. */
export function resolveMarker({ param, visit, loadStart, now }: ResolveInput): Marker {
  if (param === "24h") return { since: new Date(now.getTime() - 24 * 3600_000).toISOString(), kind: "periodo", label: "nas últimas 24 horas" };
  if (param === "7d") return { since: new Date(now.getTime() - 7 * 24 * 3600_000).toISOString(), kind: "periodo", label: "nos últimos 7 dias" };
  if (param === "carga") return { since: loadStart, kind: "carga", label: "desde a carga inicial" };
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && isValidIsoDate(param)) {
    return { since: startOfDaySaoPaulo(param), kind: "periodo", label: "desde o dia escolhido" };
  }
  if (!visit) return { since: loadStart, kind: "carga", label: "desde a carga inicial (primeira visita)" };
  const recent = now.getTime() - Date.parse(visit.last_visit_at) < SAME_VISIT_MS;
  if (recent) {
    return visit.previous_visit_at
      ? { since: visit.previous_visit_at, kind: "visita", label: "desde a sua visita anterior" }
      : { since: loadStart, kind: "carga", label: "desde a carga inicial (primeira visita)" };
  }
  return { since: visit.last_visit_at, kind: "visita", label: "desde a sua última visita" };
}
