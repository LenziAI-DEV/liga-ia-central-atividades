import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface Encrypted {
  ciphertext: string;
  iv: string;
  tag: string;
}

function keyFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY inválida: precisa ter 32 bytes em base64.");
  return key;
}

/** Cifra um valor JSON com AES-256-GCM (IV aleatório por gravação) — [GUIA §10], ADR-07. */
export function encryptJson(value: unknown, base64Key: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/** Decifra e verifica a autenticidade. Chave errada ou dado adulterado lançam erro. */
export function decryptJson<T>(encrypted: Encrypted, base64Key: string): T {
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}
