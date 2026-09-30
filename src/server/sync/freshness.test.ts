import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/helpers/db";
import { acquireRun, emptyCounts, finishRun } from "@/server/db/repos/sync-runs-repo";
import { syncFreshness } from "./freshness";

const t = (s: number) => new Date(Date.UTC(2026, 8, 30, 12, 0, s));

function run(db: ReturnType<typeof testDb>, at: number, status: "success" | "partial" | "failed") {
  const id = acquireRun(db, "scheduled", t(at))!;
  finishRun(db, id, status, emptyCounts(), t(at + 1), status === "failed" ? { code: "network", message: "x" } : undefined);
}

describe("syncFreshness", () => {
  it("sem nenhum ciclo concluído não há o que dizer", () => {
    expect(syncFreshness(testDb(), 60, t(0))).toEqual({ stale: false, reason: null, lastOkAt: null });
  });

  it("sucesso recente = em dia; parcial também conta como leitura", () => {
    const db = testDb();
    run(db, 0, "partial");
    expect(syncFreshness(db, 60, t(100)).stale).toBe(false);
  });

  it("último ciclo falhou = desatualizado, com o horário do último sucesso (CA-F3.6)", () => {
    const db = testDb();
    run(db, 0, "success");
    run(db, 60, "failed");
    expect(syncFreshness(db, 60, t(70))).toMatchObject({ stale: true, reason: "failed", lastOkAt: t(1).toISOString() });
  });

  it("último sucesso há mais de 2× o intervalo = desatualizado, mesmo sem falha registrada", () => {
    const db = testDb();
    run(db, 0, "success");
    expect(syncFreshness(db, 60, t(121)).stale).toBe(false);
    expect(syncFreshness(db, 60, t(122))).toMatchObject({ stale: true, reason: "old" });
  });

  it("voltar a dar certo limpa o aviso", () => {
    const db = testDb();
    run(db, 0, "success");
    run(db, 60, "failed");
    run(db, 120, "success");
    expect(syncFreshness(db, 60, t(125)).stale).toBe(false);
  });
});
