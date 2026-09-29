import { describe, expect, it } from "vitest";
import { REDACTED, redact, redactString } from "./redact";

describe("redact", () => {
  it("remove valores de chaves sensíveis, inclusive aninhadas", () => {
    const out = redact({
      event: "oauth.callback",
      code: "4/abc",
      nested: { refresh_token: "1//xyz", client_secret: "GOCSPX-123", keep: "ok" },
    }) as Record<string, unknown>;
    expect(out.code).toBe(REDACTED);
    expect(out.nested).toEqual({ refresh_token: REDACTED, client_secret: REDACTED, keep: "ok" });
    expect(out.event).toBe("oauth.callback");
  });

  it("preserva campos de diagnóstico que não são segredo", () => {
    const out = redact({ error_code: "invalid_grant", file_id: "abc", dedupe_key: "k" }) as Record<string, unknown>;
    expect(out).toEqual({ error_code: "invalid_grant", file_id: "abc", dedupe_key: "k" });
  });

  it("remove padrões de token dentro de textos livres", () => {
    const text = redactString("falhou com ya29.a0AfH6SM e sk-ant-api03-XYZ e 1//0gAbC");
    expect(text).not.toMatch(/ya29\.a0|sk-ant-api03|1\/\/0gAbC/);
  });

  it("remove code e state de URLs de callback", () => {
    const text = redactString("GET /api/auth/google/callback?state=abc123&code=4/0Adeu&scope=x");
    expect(text).toBe(`GET /api/auth/google/callback?state=${REDACTED}&code=${REDACTED}&scope=x`);
  });

  it("serializa erros sem vazar tokens na mensagem", () => {
    expect(redact(new Error("token ya29.segredo expirou"))).toEqual({
      name: "Error",
      message: `token ${REDACTED} expirou`,
    });
  });
});
