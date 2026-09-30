import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TAG_BYTES = 16;

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
  const tag = Buffer.from(encrypted.tag, "base64");
  if (tag.length !== TAG_BYTES) throw new Error("Tag de autenticação com tamanho inválido.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(encrypted.iv, "base64"), {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}
