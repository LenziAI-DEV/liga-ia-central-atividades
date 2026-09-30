import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("@/server/db", () => ({ getDb: () => getDb() }));
vi.mock("@/server/sync/start-scheduler", () => ({ startScheduler: vi.fn() }));

describe("boot", () => {
  beforeEach(() => {
    (globalThis as { __liaBooted?: boolean }).__liaBooted = undefined;
    getDb.mockReset();
  });

  it("banco inválido não derruba o servidor e a próxima chamada tenta de novo", async () => {
    const { boot } = await import("./boot");
    const { getSchedulerStartError } = await import("@/server/sync/scheduler");
    getDb.mockImplementation(() => {
      throw new Error("caminho inválido");
    });
    expect(() => boot()).not.toThrow();
    expect(getSchedulerStartError()).toBe("start_failed");
    expect((globalThis as { __liaBooted?: boolean }).__liaBooted).toBeUndefined();

    getDb.mockReturnValue({ run: vi.fn() });
    boot();
    expect(getSchedulerStartError()).toBeNull();
    expect((globalThis as { __liaBooted?: boolean }).__liaBooted).toBe(true);
  });
});
