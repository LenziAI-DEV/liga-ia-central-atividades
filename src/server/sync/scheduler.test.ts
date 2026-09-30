import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduler } from "./scheduler";

const opts = { intervalMs: 60_000, maxBackoffMs: 300_000, firstDelayMs: 5_000 };

describe("createScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("primeiro ciclo em ~5 s e depois a cada intervalo", async () => {
    const runCycle = vi.fn(async () => ({ status: "success" }));
    const s = createScheduler({ ...opts, runCycle });
    s.start();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(runCycle).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(runCycle).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runCycle).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(runCycle).toHaveBeenCalledTimes(4);
    s.stop();
  });

  it("iniciar duas vezes não duplica (register() chamado 2x)", async () => {
    const runCycle = vi.fn(async () => ({ status: "success" }));
    const s = createScheduler({ ...opts, runCycle });
    s.start();
    s.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runCycle).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it("nunca sobrepõe ciclos: o próximo só é agendado depois que o atual termina", async () => {
    let release: () => void = () => {};
    const runCycle = vi.fn(() => new Promise<{ status: string }>((resolve) => (release = () => resolve({ status: "success" }))));
    const s = createScheduler({ ...opts, runCycle });
    s.start();
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(runCycle).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runCycle).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it("falhas dobram o intervalo até o teto e sucesso volta ao normal", async () => {
    const delays: number[] = [];
    let status = "failed";
    const s = createScheduler({
      ...opts,
      runCycle: async () => ({ status }),
      onCycle: (_r, info) => delays.push(info.nextInMs),
    });
    s.start();
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(120_000);
    await vi.advanceTimersByTimeAsync(240_000);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(delays).toEqual([120_000, 240_000, 300_000, 300_000]);
    expect(s.status().consecutiveFailures).toBe(4);
    status = "success";
    await vi.advanceTimersByTimeAsync(300_000);
    expect(delays.at(-1)).toBe(60_000);
    expect(s.status()).toMatchObject({ consecutiveFailures: 0, lastStatus: "success" });
    s.stop();
  });

  it("exceção no ciclo conta como falha e o agendador continua vivo", async () => {
    const runCycle = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ status: "success" });
    const s = createScheduler({ ...opts, runCycle });
    s.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(s.status()).toMatchObject({ lastStatus: "error", consecutiveFailures: 1 });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(runCycle).toHaveBeenCalledTimes(2);
    s.stop();
  });

  it("stop() cancela e não deixa ciclo pendente", async () => {
    const runCycle = vi.fn(async () => ({ status: "success" }));
    const s = createScheduler({ ...opts, runCycle });
    s.start();
    s.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(runCycle).not.toHaveBeenCalled();
    expect(s.status().running).toBe(false);
  });
});

describe("ensureScheduler", () => {
  it("register() chamado duas vezes cria um só agendador", async () => {
    const { ensureScheduler, resetSchedulerForTests } = await import("./scheduler");
    resetSchedulerForTests();
    const build = vi.fn(() => createScheduler({ ...opts, runCycle: async () => ({ status: "success" }) }));
    const a = ensureScheduler(build);
    const b = ensureScheduler(build);
    expect(a).toBe(b);
    expect(build).toHaveBeenCalledTimes(1);
    resetSchedulerForTests();
  });
});
