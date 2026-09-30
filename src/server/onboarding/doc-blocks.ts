import type { TextExtract } from "@/server/extract/types";

export type Block =
  | { kind: "paragraph"; text: string; section: string | null; beforeFirstHeading: boolean }
  | { kind: "item"; text: string; ordered: boolean; section: string | null };

const HEADING = /^(#{1,6})\s+(.*)$/;
const ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

/**
 * Divide o texto extraído de um documento em parágrafos e itens de lista, sempre literais
 * (o texto não é reescrito). Pula o título, os metadados `chave: valor` do topo e as linhas em branco.
 */
export function readBlocks(extract: TextExtract): Block[] {
  const metaKeys = new Set(Object.keys(extract.metadata));
  const blocks: Block[] = [];
  let section: string | null = null;
  let seenHeading = false;
  let inTop = true;
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" "), section, beforeFirstHeading: !seenHeading });
      paragraph = [];
    }
  };

  for (const raw of extract.text.split("\n")) {
    const line = raw.trim();
    if (line === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      if (inTop && heading[1].length === 1 && !seenHeading && blocks.length === 0 && section === null) {
        // título do documento: não conta como seção
        inTop = true;
        continue;
      }
      seenHeading = true;
      inTop = false;
      section = heading[2].trim();
      continue;
    }
    const colon = line.indexOf(":");
    if (inTop && colon > 0 && metaKeys.has(line.slice(0, colon).trim())) continue;
    const item = ITEM.exec(line);
    if (item) {
      flush();
      inTop = false;
      blocks.push({ kind: "item", text: item[3].trim(), ordered: item[2] !== undefined, section });
      continue;
    }
    inTop = false;
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Divide em frases sem reescrever nenhuma (o ponto final fica com a frase). */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
}
