import { describe, expect, it } from "vitest";
import { toDriveError } from "./google-drive-gateway";

/** Forma dos erros do gaxios: `response.status` e `response.data` (objeto, texto ou bytes). */
const apiError = (status: number, data: unknown, message = "") => ({ message, response: { status, data } });
const body = (reason: string) => ({ error: { code: 403, errors: [{ reason }] } });

describe("toDriveError", () => {
  it("autorização expirada ou revogada vira 'auth'", () => {
    expect(toDriveError(apiError(400, { error: "invalid_grant" }, "invalid_grant")).kind).toBe("auth");
    expect(toDriveError(apiError(401, {})).kind).toBe("auth");
  });

  it("motivos de cota viram 'rate_limited' (com nova tentativa), inclusive em 403", () => {
    for (const reason of ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "quotaExceeded"]) {
      expect(toDriveError(apiError(403, body(reason))).kind, reason).toBe("rate_limited");
    }
    expect(toDriveError(apiError(429, {})).kind).toBe("rate_limited");
  });

  it("lê o motivo mesmo quando o corpo do erro chega como texto ou bytes (export/download)", () => {
    const json = JSON.stringify(body("exportSizeLimitExceeded"));
    expect(toDriveError(apiError(403, json)).kind).toBe("too_large");
    expect(toDriveError(apiError(403, new TextEncoder().encode(json).buffer)).kind).toBe("too_large");
    expect(toDriveError(apiError(403, "não é json")).kind).toBe("forbidden");
  });

  it("limite de exportação e arquivo não baixável têm mensagens próprias", () => {
    expect(toDriveError(apiError(403, body("exportSizeLimitExceeded"))).safeMessage).toMatch(/10 MB/);
    expect(toDriveError(apiError(403, body("fileNotDownloadable"))).kind).toBe("not_downloadable");
  });

  it("404, 403 de permissão, 5xx e rede", () => {
    expect(toDriveError(apiError(404, {})).kind).toBe("not_found");
    expect(toDriveError(apiError(403, body("insufficientFilePermissions"))).kind).toBe("forbidden");
    expect(toDriveError(apiError(503, {})).kind).toBe("transient");
    expect(toDriveError({ code: "ECONNRESET", message: "socket hang up" }).kind).toBe("transient");
    expect(toDriveError(new Error("???")).kind).toBe("unknown");
  });

  it("a mensagem segura nunca repete o texto bruto do erro", () => {
    const error = toDriveError(apiError(500, {}, "falhou com ya29.segredo"));
    expect(error.safeMessage).not.toContain("ya29");
  });
});
