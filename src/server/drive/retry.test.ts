import { describe, expect, it, vi } from "vitest";
import { DriveError } from "./errors";
import { withRetry } from "./retry";

const noSleep = { sleep: async () => {}, random: () => 1 };

describe("withRetry", () => {
  it("repete erros temporários até dar certo", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new DriveError("rate_limited", "cota"))
      .mockRejectedValueOnce(new DriveError("transient", "rede"))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, noSleep)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("não repete erros de permissão ou ausência", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new DriveError("not_found", "sumiu"));
    await expect(withRetry(fn, noSleep)).rejects.toMatchObject({ kind: "not_found" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("desiste depois do limite de tentativas", async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new DriveError("transient", "rede"));
    await expect(withRetry(fn, { ...noSleep, retries: 2 })).rejects.toMatchObject({ kind: "transient" });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("espera cresce exponencialmente com teto", async () => {
    const waits: number[] = [];
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new DriveError("transient", "rede"));
    await expect(
      withRetry(fn, { retries: 4, baseMs: 1000, maxMs: 5000, random: () => 1, sleep: async (ms) => void waits.push(ms) }),
    ).rejects.toBeInstanceOf(DriveError);
    expect(waits).toEqual([1000, 2000, 4000, 5000]);
  });
});
