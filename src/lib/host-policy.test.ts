import { describe, expect, it } from "vitest";
import { canonicalHostResponse, decideHost } from "./host-policy";

describe("canonicalHostResponse", () => {
  it("leva ao host canônico por HTML (o Next relativiza Location entre 127.0.0.1 e localhost)", async () => {
    const response = canonicalHostResponse("http://localhost:3000/api/auth/google/start?x=1&y=2");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    const html = await response.text();
    expect(html).toContain('http-equiv="refresh" content="0;url=http://localhost:3000/api/auth/google/start?x=1&amp;y=2"');
    expect(html).toContain('<a href="http://localhost:3000/api/auth/google/start?x=1&amp;y=2">');
  });

  it("escapa o endereço (o caminho vem da requisição)", async () => {
    const html = await canonicalHostResponse(`http://localhost:3000/"><script>alert(1)</script>`).text();
    expect(html).not.toContain("<script>");
  });
});

const BASE = "http://localhost:3000";

describe("decideHost (host canônico e proteção contra DNS rebinding)", () => {
  it("o host canônico passa", () => {
    expect(decideHost({ host: "localhost:3000", baseUrl: BASE, method: "GET", path: "/" })).toEqual({ action: "allow" });
    expect(decideHost({ host: "LOCALHOST:3000", baseUrl: BASE, method: "POST", path: "/sincronizacao" })).toEqual({
      action: "allow",
    });
  });

  it("apelidos de loopback na mesma porta são redirecionados ao host canônico (GET)", () => {
    expect(decideHost({ host: "127.0.0.1:3000", baseUrl: BASE, method: "GET", path: "/api/auth/google/start?x=1" })).toEqual({
      action: "redirect",
      location: "http://localhost:3000/api/auth/google/start?x=1",
    });
    expect(decideHost({ host: "[::1]:3000", baseUrl: BASE, method: "HEAD", path: "/" })).toMatchObject({ action: "redirect" });
  });

  it("apelido de loopback em requisição que altera estado é recusado", () => {
    expect(decideHost({ host: "127.0.0.1:3000", baseUrl: BASE, method: "POST", path: "/sincronizacao" })).toEqual({
      action: "reject",
    });
  });

  it("qualquer outro host é recusado (rede local, DNS rebinding, Host ausente)", () => {
    for (const host of ["192.168.0.10:3000", "evil.example:3000", "localhost:4000", "localhost", "", null]) {
      expect(decideHost({ host, baseUrl: BASE, method: "GET", path: "/" }), String(host)).toEqual({ action: "reject" });
    }
  });

  it("respeita outra APP_BASE_URL configurada", () => {
    expect(decideHost({ host: "localhost:8080", baseUrl: "http://localhost:8080", method: "GET", path: "/" })).toEqual({
      action: "allow",
    });
  });
});
