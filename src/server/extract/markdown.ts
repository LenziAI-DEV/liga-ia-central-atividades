import { normalizeText } from "./normalize";
import type { Section, TextExtract } from "./types";

/**
 * As expressões abaixo são lineares de propósito: o conteúdo vem de arquivos do
 * Drive (não confiável), e o extrator roda no mesmo processo da interface. Nada de
 * quantificadores sobrepostos como `(.+?)\s*#*\s*$` (backtracking catastrófico).
 */
const HEADING = /^(#{1,6})[ \t]+(.*)$/;
/** `chave: valor` com chave de uma palavra (ex.: `status`, `data_da_reuniao`). */
const METADATA = /^[ \t]*([\p{L}_][\p{L}\p{N}_]*)[ \t]*:(.*)$/u;
const METADATA_SCAN_LINES = 20;
/** Abertura/fechamento de bloco de código cercado (``` ou ~~~). */
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;
/** Linhas maiores que isso não são títulos nem metadados (continuam no texto). */
const MAX_STRUCTURE_LINE = 4096;

/** Remove escapes de Markdown (o export de Google Docs escreve `data\_da\_reuniao`). */
function unescapeMarkdown(value: string): string {
  return value.replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, "$1");
}

const EMPHASIS = new Set(["*", "_", "`"]);

/** Tira marcadores de ênfase das pontas (`**texto**` → `texto`), em tempo linear. */
function stripEmphasis(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && EMPHASIS.has(value[start])) start++;
  while (end > start && EMPHASIS.has(value[end - 1])) end--;
  return value.slice(start, end).trim();
}

/** Sequência `#` de fechamento do título (CommonMark: precisa vir depois de espaço). */
function stripClosingHashes(value: string): string {
  const text = value.trimEnd();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end--;
  if (end === text.length) return text;
  if (end === 0) return "";
  return text[end - 1] === " " || text[end - 1] === "\t" ? text.slice(0, end).trimEnd() : text;
}

/**
 * Extrai texto, títulos e metadados de Markdown (.md ou export de Google Doc).
 * Os metadados são linhas `chave: valor` no topo do documento, antes da primeira
 * seção `##` — não são front-matter YAML.
 */
export function extractMarkdown(raw: string): TextExtract {
  const text = normalizeText(raw);
  const lines = text.split("\n");
  const sections: Section[] = [];
  // Sem protótipo: chaves como `constructor` ou `toString` são metadados comuns.
  const metadata = Object.create(null) as Record<string, string>;
  let title: string | null = null;
  let metadataOpen = true;
  /** Caractere da cerca aberta (`` ` `` ou `~`); dentro dela nada é título nem metadado. */
  let fence: string | null = null;

  lines.forEach((line, index) => {
    if (line.length > MAX_STRUCTURE_LINE) return;
    const fenceMatch = FENCE.exec(line);
    if (fence !== null) {
      if (fenceMatch && fenceMatch[1][0] === fence) fence = null;
      return;
    }
    if (fenceMatch) {
      fence = fenceMatch[1][0];
      return;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const headingText = stripEmphasis(unescapeMarkdown(stripClosingHashes(heading[2])));
      if (headingText) {
        const level = heading[1].length;
        sections.push({ heading: headingText, level, line: index + 1 });
        if (level === 1 && title === null) title = headingText;
        if (level >= 2) metadataOpen = false;
        return;
      }
    }
    if (!metadataOpen || index >= METADATA_SCAN_LINES) return;
    const meta = METADATA.exec(unescapeMarkdown(stripEmphasis(line)));
    if (meta) {
      const key = meta[1].toLowerCase();
      const value = stripEmphasis(meta[2].trim());
      if (value && !(key in metadata)) metadata[key] = value;
    }
  });

  return { kind: "text", text, title, sections, metadata };
}
