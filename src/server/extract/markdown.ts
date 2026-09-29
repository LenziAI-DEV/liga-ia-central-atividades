import { normalizeText } from "./normalize";
import type { Section, TextExtract } from "./types";

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
/** `chave: valor` com chave de uma palavra (ex.: `status`, `data_da_reuniao`). */
const METADATA = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*:\s*(.+?)\s*$/u;
const METADATA_SCAN_LINES = 20;

/** Remove escapes de Markdown (o export de Google Docs escreve `data\_da\_reuniao`). */
function unescapeMarkdown(value: string): string {
  return value.replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, "$1");
}

function stripEmphasis(value: string): string {
  return value.replace(/^[*_`]+|[*_`]+$/g, "").trim();
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
  const metadata: Record<string, string> = {};
  let title: string | null = null;
  let metadataOpen = true;

  lines.forEach((line, index) => {
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const headingText = stripEmphasis(unescapeMarkdown(heading[2]));
      sections.push({ heading: headingText, level, line: index + 1 });
      if (level === 1 && title === null) title = headingText;
      if (level >= 2) metadataOpen = false;
      return;
    }
    if (!metadataOpen || index >= METADATA_SCAN_LINES) return;
    const meta = METADATA.exec(unescapeMarkdown(stripEmphasis(line)));
    if (meta) {
      const key = meta[1].toLowerCase();
      if (!(key in metadata)) metadata[key] = stripEmphasis(meta[2]);
    }
  });

  return { kind: "text", text, title, sections, metadata };
}
