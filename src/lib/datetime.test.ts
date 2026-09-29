import { describe, expect, it } from "vitest";
import {
  daysBetween,
  dueState,
  fixedClock,
  formatDateBR,
  formatDateTimeBR,
  isValidIsoDate,
  isoDateFromUtcParts,
  isoDateInSaoPaulo,
} from "./datetime";

describe("datetime", () => {
  it("valida datas de calendário", () => {
    expect(isValidIsoDate("2026-10-05")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("05/10/2026")).toBe(false);
    expect(isValidIsoDate("2026-10-5")).toBe(false);
  });

  it("usa o fuso de São Paulo para 'hoje'", () => {
    // 02:30 UTC de 05/10 ainda é 04/10 em São Paulo (UTC−3).
    expect(isoDateInSaoPaulo(new Date("2026-10-05T02:30:00Z"))).toBe("2026-10-04");
    expect(isoDateInSaoPaulo(new Date("2026-10-05T03:30:00Z"))).toBe("2026-10-05");
  });

  it("não desloca datas de planilha (serial .5 e meia-noite UTC)", () => {
    expect(isoDateFromUtcParts(new Date(Date.UTC(2026, 9, 5, 12)))).toBe("2026-10-05");
    expect(isoDateFromUtcParts(new Date(Date.UTC(2026, 9, 5, 0)))).toBe("2026-10-05");
  });

  it("formata datas e instantes em pt-BR", () => {
    expect(formatDateBR("2026-10-05")).toBe("05/10/2026");
    expect(formatDateTimeBR("2026-09-29T03:04:00Z")).toBe("29/09/2026 00:04");
  });

  it("calcula a situação do prazo sem alterar a data", () => {
    expect(daysBetween("2026-10-04", "2026-10-07")).toBe(3);
    expect(dueState(null, "2026-10-04")).toBe("sem_prazo");
    expect(dueState("2026-10-03", "2026-10-04")).toBe("vencido");
    expect(dueState("2026-10-04", "2026-10-04")).toBe("hoje");
    expect(dueState("2026-10-07", "2026-10-04")).toBe("proximo");
    expect(dueState("2026-10-11", "2026-10-04")).toBe("no_prazo");
  });

  it("relógio fixo para testes", () => {
    expect(fixedClock("2026-10-01T12:00:00Z").now().toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });
});
