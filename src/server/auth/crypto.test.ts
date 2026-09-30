import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "./crypto";

const key = randomBytes(32).toString("base64");

describe("crypto (AES-256-GCM)", () => {
  it("cifra e decifra o mesmo valor", () => {
    const value = { refresh_token: "1//segredo", expiry_date: 123 };
    expect(decryptJson(encryptJson(value, key), key)).toEqual(value);
  });

  it("o texto cifrado não contém o segredo e muda a cada gravação", () => {
    const a = encryptJson({ refresh_token: "1//segredo" }, key);
    const b = encryptJson({ refresh_token: "1//segredo" }, key);
    expect(Buffer.from(a.ciphertext, "base64").toString("utf8")).not.toContain("segredo");
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("chave errada falha (não devolve lixo)", () => {
    const encrypted = encryptJson({ a: 1 }, key);
    expect(() => decryptJson(encrypted, randomBytes(32).toString("base64"))).toThrow();
  });

  it("tag de autenticação truncada é recusada", () => {
    const encrypted = encryptJson({ a: 1 }, key);
    const shortTag = Buffer.from(encrypted.tag, "base64").subarray(0, 4).toString("base64");
    expect(() => decryptJson({ ...encrypted, tag: shortTag }, key)).toThrow();
  });

  it("dado adulterado falha na verificação de autenticidade", () => {
    const encrypted = encryptJson({ a: 1 }, key);
    const tampered = Buffer.from(encrypted.ciphertext, "base64");
    tampered[0] ^= 0xff;
    expect(() => decryptJson({ ...encrypted, ciphertext: tampered.toString("base64") }, key)).toThrow();
  });
});
