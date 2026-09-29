import { describe, expect, it } from "vitest";
import { DRIVE_READONLY_SCOPE } from "@/server/config/env";
import { assertReadonlyScope, statesMatch } from "./google-oauth";
import { decodeOAuthCookie, encodeOAuthCookie } from "./oauth-cookie";

describe("assertReadonlyScope (CA-F13.2)", () => {
  it("aceita só leitura do Drive, sozinha ou com escopos alheios ao Drive", () => {
    expect(() => assertReadonlyScope(DRIVE_READONLY_SCOPE)).not.toThrow();
    expect(() => assertReadonlyScope(`openid ${DRIVE_READONLY_SCOPE}`)).not.toThrow();
  });

  it("recusa autorização sem leitura do Drive", () => {
    expect(() => assertReadonlyScope(null)).toThrow(/leitura do Drive/);
    expect(() => assertReadonlyScope("openid email")).toThrow(/leitura do Drive/);
  });

  it("recusa qualquer escopo de escrita no Drive junto com a leitura", () => {
    for (const write of ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/drive.file"]) {
      expect(() => assertReadonlyScope(`${DRIVE_READONLY_SCOPE} ${write}`), write).toThrow(/somente leitura/);
    }
  });
});

describe("statesMatch", () => {
  it("compara em tempo constante e exige igualdade exata", () => {
    expect(statesMatch("abc123", "abc123")).toBe(true);
    expect(statesMatch("abc123", "abc124")).toBe(false);
    expect(statesMatch("abc123", "abc1234")).toBe(false);
    expect(statesMatch("abc", "")).toBe(false);
  });
});

describe("cookie do fluxo OAuth", () => {
  it("ida e volta preserva state e code_verifier", () => {
    const raw = encodeOAuthCookie({ state: "s", codeVerifier: "v" });
    expect(decodeOAuthCookie(raw)).toEqual({ state: "s", codeVerifier: "v" });
  });

  it("valor ausente, adulterado ou com tipos errados vira null", () => {
    expect(decodeOAuthCookie(undefined)).toBeNull();
    expect(decodeOAuthCookie("%%%não-base64")).toBeNull();
    expect(decodeOAuthCookie(Buffer.from('{"state":1,"codeVerifier":"v"}').toString("base64url"))).toBeNull();
  });
});
