import { createHash } from "node:crypto";
import type { Extracted } from "./types";

/**
 * Remove espaços e tabs do fim da linha em tempo linear. Uma regex como `/[ \t]+$/`
 * é quadrática numa linha com muitos espaços seguidos de texto (ReDoS).
 */
export function trimLineEnd(line: string): string {
  let end = line.length;
  while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) end--;
  return end === line.length ? line : line.slice(0, end);
}

/** Normaliza texto de documento: BOM, NFC, finais de linha, espaços de fim de linha. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(trimLineEnd)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** JSON com chaves ordenadas — a mesma estrutura sempre gera o mesmo texto. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Chave de idempotência do conteúdo extraído (ADR-06). */
export function contentHash(extracted: Extracted): string {
  return sha256(stableStringify(extracted));
}
