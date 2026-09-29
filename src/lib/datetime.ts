/** Fuso de apresentação de prazos e instantes ([ESP §2], RN-6). */
export const TIME_ZONE = "America/Sao_Paulo";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(isoInstant: string): Clock {
  const instant = new Date(isoInstant);
  return { now: () => new Date(instant) };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` que existe no calendário. */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Data de calendário (AAAA-MM-DD) de um instante, no fuso de São Paulo. */
export function isoDateInSaoPaulo(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Data de calendário a partir dos componentes UTC. Usada para datas de planilha,
 * que o exceljs entrega como meia-noite/meio-dia UTC: converter pelo fuso local
 * deslocaria o dia (DN-13, RT-H).
 */
export function isoDateFromUtcParts(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `2026-10-05` → `05/10/2026`. */
export function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Instante ISO → `29/09/2026 00:04` em São Paulo. */
export function formatDateTimeBR(isoInstant: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoInstant));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Diferença em dias de calendário entre duas datas `AAAA-MM-DD` (to − from). */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const toUtc = (s: string) => Date.parse(`${s}T00:00:00Z`);
  return Math.round((toUtc(toIsoDate) - toUtc(fromIsoDate)) / 86_400_000);
}

export type DueState = "sem_prazo" | "vencido" | "hoje" | "proximo" | "no_prazo";

export const DUE_LABEL: Record<DueState, string> = {
  sem_prazo: "a definir",
  vencido: "vencido",
  hoje: "vence hoje",
  proximo: "vence em breve",
  no_prazo: "no prazo",
};

/** Situação de um prazo em relação a "hoje" (ambos AAAA-MM-DD). Nunca altera a data (RNF-13). */
export function dueState(dueDate: string | null, today: string, soonDays = 3): DueState {
  if (!dueDate) return "sem_prazo";
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "vencido";
  if (diff === 0) return "hoje";
  if (diff <= soonDays) return "proximo";
  return "no_prazo";
}
