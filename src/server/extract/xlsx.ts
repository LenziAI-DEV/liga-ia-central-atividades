import { XMLParser, XMLValidator } from "fast-xml-parser";
import JSZip from "jszip";
import { isValidIsoDate, isoDateFromUtcParts } from "@/lib/datetime";
import { AppError } from "@/server/errors";
import { stripBom } from "./normalize";
import type { CellValue, Sheet, SheetExtract, SheetRow } from "./types";

/**
 * Leitor de `.xlsx` próprio (JSZip + parser XML sem prefixos de namespace).
 * Motivo: a planilha do pacote da banca é gerada pelo OpenXML SDK com prefixo
 * `x:` nos elementos, caminhos absolutos nos `.rels` e BOM — formatos que o exceljs
 * não lê. Este leitor aceita esse estilo e o do Excel (DEC-011).
 *
 * Regra de robustez (F2.8, AR-16): estrutura ilegível lança erro — parte ausente,
 * XML inválido, relacionamento quebrado ou shared string inexistente nunca viram
 * "planilha vazia" nem "célula vazia".
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  isArray: (name) => ["sheet", "Relationship", "si", "r", "row", "c", "numFmt", "xf"].includes(name),
});

type XmlNode = Record<string, unknown>;

/**
 * Formatos de data embutidos do Excel (numFmtId): 14–17 são datas e 22 é data e
 * hora. 18–21 e 45–47 são só hora/duração e não viram data.
 */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22]);

const REL_TYPE = {
  sharedStrings: "/sharedStrings",
  styles: "/styles",
} as const;

/** Erro de leitura com motivo seguro para a tabela de fontes. */
class XlsxError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("xlsx_invalid", message, options);
  }
}

function asText(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(asText).join("");
  const obj = node as XmlNode;
  // `t`/`r` primeiro: com `trimValues: false`, a indentação entre elementos vira `#text`.
  if ("t" in obj) return asText(obj.t);
  if ("r" in obj) return asText(obj.r);
  if ("#text" in obj) return asText(obj["#text"]);
  return "";
}

/**
 * Formato personalizado de data? Só se houver dia, ano ou mês. `m` é minuto quando
 * vem depois de hora (`h:mm`) ou antes de segundo (`mm:ss`); `AM/PM` não é mês.
 * Formatos só de hora (`hh:mm`, `[$-F400]h:mm:ss AM/PM`) não viram data.
 */
export function isDateFormatCode(code: string): boolean {
  const section = code.split(";")[0] ?? "";
  const cleaned = section
    .replace(/"[^"]*"|\[[^\]]*\]|\\.|_.|\*./g, "") // literais, [cor]/[$-…], escapes, espaçamento
    .replace(/A\/P|AM\/PM/gi, "")
    .toLowerCase();
  if (/[dy]/.test(cleaned)) return true;
  const tokens = cleaned.match(/[hms]+/g) ?? [];
  return tokens.some((token, i) => {
    if (token[0] !== "m") return false;
    const afterHour = tokens[i - 1]?.[0] === "h";
    const beforeSecond = tokens[i + 1]?.[0] === "s";
    return !afterHour && !beforeSecond;
  });
}

function resolveTarget(target: string): string {
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/** Nomes de partes OPC não diferenciam maiúsculas; o JSZip diferencia. */
function findEntry(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const exact = zip.file(path);
  if (exact) return exact;
  const lower = path.toLowerCase();
  const match = Object.keys(zip.files).find((name) => name.toLowerCase() === lower);
  return match ? zip.file(match) : null;
}

async function readXml(zip: JSZip, path: string): Promise<XmlNode | null> {
  const file = findEntry(zip, path);
  if (!file) return null;
  const xml = stripBom(await file.async("string"));
  if (XMLValidator.validate(xml) !== true) throw new XlsxError(`XML inválido em ${path}.`);
  return parser.parse(xml) as XmlNode;
}

/** Último serial válido do Excel: 9999-12-31. */
const MAX_DATE_SERIAL = 2_958_465;

function serialToIsoDate(serial: number, date1904: boolean): string | null {
  if (!(serial >= 1 && serial <= MAX_DATE_SERIAL)) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return isoDateFromUtcParts(new Date(epoch + Math.round(serial * 86_400_000)));
}

/** Índice (0-based) → letras de coluna: 0 → A, 25 → Z, 26 → AA. */
function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const ch of letters.toUpperCase()) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

const clean = (text: string) => text.normalize("NFC").trim();

interface Relation {
  target: string;
  type: string;
}

/**
 * Lê todas as abas: a primeira linha com conteúdo é o cabeçalho; as seguintes com
 * pelo menos uma célula preenchida são dados. Linhas só com formatação (como na
 * planilha vazia de conflito) são ignoradas. Arquivo inválido lança erro — nunca
 * vira "planilha vazia" (AR-16).
 */
export async function extractXlsx(data: Uint8Array): Promise<SheetExtract> {
  try {
    return await readWorkbook(data);
  } catch (error) {
    if (error instanceof XlsxError) throw error;
    throw new XlsxError("Arquivo .xlsx inválido ou corrompido.", { cause: error });
  }
}

async function readWorkbook(data: Uint8Array): Promise<SheetExtract> {
  const zip = await JSZip.loadAsync(data);

  const workbook = (await readXml(zip, "xl/workbook.xml"))?.workbook as XmlNode | undefined;
  if (!workbook) throw new XlsxError("Arquivo .xlsx sem workbook.xml legível.");

  const date1904 = ["1", "true"].includes(String((workbook.workbookPr as XmlNode | undefined)?.["@_date1904"] ?? ""));
  const sheetEntries = ((workbook.sheets as XmlNode | undefined)?.sheet as XmlNode[] | undefined) ?? [];
  if (sheetEntries.length === 0) throw new XlsxError("Arquivo .xlsx sem nenhuma aba.");

  const relsXml = await readXml(zip, "xl/_rels/workbook.xml.rels");
  if (!relsXml && sheetEntries.length > 0) throw new XlsxError("Arquivo .xlsx sem relacionamentos das abas.");
  const relations = new Map<string, Relation>();
  for (const rel of ((relsXml?.Relationships as XmlNode | undefined)?.Relationship as XmlNode[] | undefined) ?? []) {
    relations.set(String(rel["@_Id"]), { target: resolveTarget(String(rel["@_Target"])), type: String(rel["@_Type"] ?? "") });
  }
  const partOf = (type: string, fallback: string) =>
    [...relations.values()].find((r) => r.type.endsWith(type))?.target ?? fallback;

  const sstXml = await readXml(zip, partOf(REL_TYPE.sharedStrings, "xl/sharedStrings.xml"));
  const sharedStrings = sstXml
    ? (((sstXml.sst as XmlNode | undefined)?.si as unknown[] | undefined) ?? []).map((si) => clean(asText(si)))
    : null;

  const styleSheet = (await readXml(zip, partOf(REL_TYPE.styles, "xl/styles.xml")))?.styleSheet as XmlNode | undefined;
  const customFormats = new Map<number, string>();
  for (const fmt of ((styleSheet?.numFmts as XmlNode | undefined)?.numFmt as XmlNode[] | undefined) ?? []) {
    customFormats.set(Number(fmt["@_numFmtId"]), String(fmt["@_formatCode"] ?? ""));
  }
  const dateStyles = new Set<number>();
  (((styleSheet?.cellXfs as XmlNode | undefined)?.xf as XmlNode[] | undefined) ?? []).forEach((xf, index) => {
    const id = Number(xf["@_numFmtId"] ?? 0);
    const custom = customFormats.get(id);
    if (BUILTIN_DATE_FORMATS.has(id) || (custom !== undefined && isDateFormatCode(custom))) dateStyles.add(index);
  });

  const context: CellContext = { sharedStrings, dateStyles, date1904 };
  const sheets: Sheet[] = [];
  for (const entry of sheetEntries) {
    const name = String(entry["@_name"] ?? "");
    const relation = relations.get(String(entry["@_id"] ?? ""));
    if (!relation) throw new XlsxError(`A aba "${name}" não tem relacionamento no pacote.`);
    // Abas de gráfico/diálogo não têm células: ficam de fora.
    if (/(chartsheet|dialogsheet)$/i.test(relation.type)) continue;
    const worksheet = (await readXml(zip, relation.target))?.worksheet as XmlNode | undefined;
    if (!worksheet) throw new XlsxError(`A aba "${name}" não foi encontrada no pacote.`);
    sheets.push(readSheet(name, worksheet, context));
  }
  return { kind: "sheet", sheets };
}

interface CellContext {
  sharedStrings: string[] | null;
  dateStyles: Set<number>;
  date1904: boolean;
}

function readSheet(name: string, worksheet: XmlNode, context: CellContext): Sheet {
  const rowNodes = ((worksheet.sheetData as XmlNode | undefined)?.row as XmlNode[] | undefined) ?? [];
  let header: string[] | null = null;
  const columns = new Map<string, string>();
  const rows: SheetRow[] = [];
  let previousRow = 0;

  for (const rowNode of rowNodes) {
    const rowNumber = rowNode["@_r"] !== undefined ? Number(rowNode["@_r"]) : previousRow + 1;
    previousRow = rowNumber;
    const cells: CellValue[] = [];
    let previousColumn = -1;
    for (const c of (rowNode.c as XmlNode[] | undefined) ?? []) {
      const ref = c["@_r"] !== undefined ? String(c["@_r"]) : `${columnName(previousColumn + 1)}${rowNumber}`;
      previousColumn = columnIndex(ref.replace(/\d+/g, ""));
      const value = readCell(c, ref, context);
      if (value) cells.push(value);
    }
    if (cells.length === 0) continue;

    if (header === null) {
      const used = new Set<string>();
      header = cells.map((cell) => {
        let label = cell.text;
        for (let n = 2; used.has(label); n++) label = `${cell.text} (${n})`;
        used.add(label);
        columns.set(cell.address.replace(/\d+/g, ""), label);
        return label;
      });
      continue;
    }
    // Sem protótipo: um cabeçalho "__proto__" vira uma coluna comum.
    const record = Object.create(null) as Record<string, CellValue>;
    for (const cell of cells) {
      const column = cell.address.replace(/\d+/g, "");
      record[columns.get(column) ?? column] = cell;
    }
    rows.push({ rowNumber, cells: record });
  }

  return { name, header: header ?? [], rows };
}

function readCell(c: XmlNode, address: string, context: CellContext): CellValue | null {
  const type = String(c["@_t"] ?? "n");
  const style = Number(c["@_s"] ?? 0);
  const raw = asText(c.v);

  if (type === "s") {
    if (raw.trim() === "") return null;
    const index = Number(raw);
    const text = context.sharedStrings?.[index];
    if (text === undefined || !Number.isInteger(index)) {
      throw new XlsxError(`A célula ${address} aponta para um texto compartilhado que não existe.`);
    }
    return text ? { address, text, raw: text } : null;
  }
  if (type === "inlineStr") {
    const text = clean(asText(c.is));
    return text ? { address, text, raw: text } : null;
  }
  if (type === "str" || type === "e") {
    const text = clean(raw);
    return text ? { address, text, raw: text } : null;
  }
  if (type === "b") return raw === "" ? null : { address, text: raw === "1" ? "VERDADEIRO" : "FALSO", raw: raw === "1" };
  if (type === "d") {
    const text = clean(raw);
    if (!text) return null;
    const date = /^\d{4}-\d{2}-\d{2}/.test(text) && isValidIsoDate(text.slice(0, 10)) ? text.slice(0, 10) : undefined;
    return { address, text: date ?? text, raw: text, ...(date ? { date } : {}) };
  }

  if (raw.trim() === "") return null;
  const number = Number(raw);
  if (Number.isNaN(number)) return { address, text: clean(raw), raw: clean(raw) };
  if (context.dateStyles.has(style)) {
    const date = serialToIsoDate(number, context.date1904);
    if (date) return { address, text: date, raw: number, date };
  }
  return { address, text: String(number), raw: number };
}
