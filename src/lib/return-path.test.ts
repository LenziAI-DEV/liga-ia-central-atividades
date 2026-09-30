import { describe, expect, it } from "vitest";
import { sameSiteReturnPath } from "./return-path";

describe("sameSiteReturnPath", () => {
  const host = "localhost:3000";
  it("volta para a página de origem, com a busca", () => {
    expect(sameSiteReturnPath("http://localhost:3000/atividades?frente=Growth", host)).toBe("/atividades?frente=Growth");
    expect(sameSiteReturnPath("http://localhost:3000/", host)).toBe("/");
  });
  it("recusa outro host, ausência de referer e caminhos que virariam endereço externo", () => {
    expect(sameSiteReturnPath("https://evil.com/x", host)).toBe("/");
    expect(sameSiteReturnPath(null, host)).toBe("/");
    expect(sameSiteReturnPath("http://localhost:3000//evil.com", host)).toBe("/");
    expect(sameSiteReturnPath("http://localhost:3000/\\evil.com", host).startsWith("//")).toBe(false);
    expect(sameSiteReturnPath("não é url", host)).toBe("/");
  });
});
