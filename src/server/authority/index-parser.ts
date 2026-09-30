/** Linhas gigantes não são estrutura do índice (mesmo limite dos extratores). */
const MAX_LINE = 4096;
const BACKTICKED = /`([^`\n]{1,200})`/g;
const FILE_LIKE = /\.[A-Za-z0-9]{1,5}$/;
const SHEET_OF = /\baba\s+`([^`\n]{1,100})`/i;
const SUPERSEDED = /superad|substitu[ií]d|obsolet/i;

export interface RegistryPointer {
  fileName: string;
  /** Aba citada ("aba `X`"); null quando o índice não diz. */
  sheetName: string | null;
  line: number;
}

export interface IndexPointers {
  /** Arquivos que o índice aponta como fonte das atividades. */
  registry: RegistryPointer[];
  /** Arquivos que o índice declara superados (só o primeiro nome da linha). */
  superseded: string[];
}

const strip = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function fileNamesOf(line: string, exclude: string | null): string[] {
  const names: string[] = [];
  for (const match of line.matchAll(BACKTICKED)) {
    const name = match[1].trim();
    if (name !== exclude && FILE_LIKE.test(name)) names.push(name);
  }
  return names;
}

/**
 * Lê o índice do acervo (ADR-11): uma linha que fala de "fonte" e de "atividades" e cita
 * um arquivo entre crases aponta o registro; "aba `X`" dá a aba. Determinístico: o texto
 * do índice nunca é interpretado por IA (não abre espaço para injeção).
 */
export function parseIndex(text: string): IndexPointers {
  const registry: RegistryPointer[] = [];
  const superseded: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.length > MAX_LINE) return;
    const sheet = SHEET_OF.exec(line)?.[1].trim() ?? null;
    const names = fileNamesOf(line, sheet);
    if (names.length === 0) return;
    const plain = strip(line);
    const isSuperseded = SUPERSEDED.test(line);
    if (isSuperseded) superseded.push(names[0]);
    if (/\bfontes?\b/.test(plain) && /\batividades\b/.test(plain)) {
      // Numa linha de substituição ("X foi substituída por Y, a nova fonte"), o primeiro
      // nome é o superado; o registro é o outro nome, se houver.
      const fileName = isSuperseded ? names.find((n) => n !== names[0]) : names[0];
      if (fileName) registry.push({ fileName, sheetName: sheet, line: index + 1 });
    }
  });
  // Um arquivo declarado superado em qualquer linha nunca é o registro vigente.
  return { registry: registry.filter((p) => !superseded.includes(p.fileName)), superseded };
}
