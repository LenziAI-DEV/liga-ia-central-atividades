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
  let inFence = false;
  let lastWasItem = false;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" "), section, beforeFirstHeading: !seenHeading });
      paragraph = [];
    }
  };

  for (const raw of extract.text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      flush();
      inFence = !inFence;
      lastWasItem = false;
      continue;
    }
    // Código, tabelas e citações não são regras nem passos: ficam de fora.
    if (inFence || line.startsWith("|") || line.startsWith(">")) continue;
    if (line === "") {
      flush();
      lastWasItem = false;
      continue;
    }
    // Linha recuada logo abaixo de um item continua o item (não vira parágrafo solto).
    const last = blocks[blocks.length - 1];
    if (lastWasItem && /^\s+\S/.test(raw) && last?.kind === "item" && !ITEM.test(line) && !HEADING.test(line)) {
      last.text = `${last.text} ${line}`;
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
      lastWasItem = true;
      continue;
    }
    inTop = false;
    lastWasItem = false;
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Divide em frases sem reescrever nenhuma: só corta em . ! ? seguido de espaço ou fim (ponto dentro de "Ata_registro.xlsx" não corta). */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!".!?".includes(text[i])) continue;
    let end = i;
    while (end + 1 < text.length && ".!?".includes(text[end + 1])) end++;
    if (end + 1 === text.length || /\s/.test(text[end + 1])) {
      out.push(text.slice(start, end + 1).trim());
      start = end + 1;
    }
    i = end;
  }
  out.push(text.slice(start).trim());
  return out.filter((x) => x.length > 0);
}
