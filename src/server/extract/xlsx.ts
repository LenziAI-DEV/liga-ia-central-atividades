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
  // Referências numéricas (`&#10;`, `&#x41;`), comuns em arquivos do openpyxl/lxml.
  htmlEntities: true,
  isArray: (name) => ["sheet", "Relationship", "si", "r", "row", "c", "numFmt", "xf"].includes(name),
});

/** Limites do formato (Excel): colunas até XFD, linhas até 1.048.576, código de formato até 255. */
const MAX_COLUMN_INDEX = 16_383;
const MAX_ROW = 1_048_576;
const MAX_FORMAT_CODE = 255;
const MAX_SHEETS = 256;
const CELL_REF = /^([A-Za-z]{1,3})([0-9]{1,7})$/;

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
 * Formatos só de hora (`hh:mm`, `[$-F400]h:mm:ss AM/PM`) e de duração (`[h]:mm`,
 * `[mm]:ss`) não viram data.
 * Varredura em uma passada, sem regex com retrocesso: o código vem do arquivo
 * (não confiável) e códigos acima do limite do Excel (255) não são formatos reais.
 */
export function isDateFormatCode(code: string): boolean {
  if (code.length > MAX_FORMAT_CODE) return false;
  const tokens: string[] = [];
  for (let i = 0; i < code.length; ) {
    const ch = code[i];
    if (ch === ";") break; // só a primeira seção (números positivos)
    if (ch === '"') {
      const end = code.indexOf('"', i + 1);
      if (end < 0) break;
      i = end + 1;
    } else if (ch === "\\" || ch === "_" || ch === "*") {
      i += 2; // escape, espaçamento e preenchimento ocupam o caractere seguinte
    } else if (ch === "[") {
      const end = code.indexOf("]", i + 1);
      if (end < 0) break;
      const inner = code.slice(i + 1, end).toLowerCase();
      // [h], [mm], [ss]: duração; [Red], [$-416]: cor e localidade, ignorados.
      if (/^(?:h+|m+|s+)$/.test(inner)) tokens.push(inner[0]);
      i = end + 1;
    } else if (code.startsWith("AM/PM", i) || code.startsWith("am/pm", i)) {
      i += 5;
    } else if (code.startsWith("A/P", i) || code.startsWith("a/p", i)) {
      i += 3;
    } else {
      const lower = ch.toLowerCase();
      if (lower === "d" || lower === "y") return true;
      if (lower === "h" || lower === "m" || lower === "s") {
        tokens.push(lower);
        while (i < code.length && code[i].toLowerCase() === lower) i++;
      } else {
        i++;
      }
    }
  }
  return tokens.some((token, i) => token === "m" && tokens[i - 1] !== "h" && tokens[i + 1] !== "s");
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
  let byLowerName = lowerNameIndex.get(zip);
  if (!byLowerName) {
    byLowerName = new Map();
    for (const name of Object.keys(zip.files)) {
      const lower = name.toLowerCase();
      if (!byLowerName.has(lower)) byLowerName.set(lower, name);
    }
    lowerNameIndex.set(zip, byLowerName);
  }
  const match = byLowerName.get(path.toLowerCase());
  return match ? zip.file(match) : null;
}

/** Índice minúsculo → nome real, montado uma vez por pacote (a busca linear era quadrática). */
const lowerNameIndex = new WeakMap<JSZip, Map<string, string>>();

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

/** Índice (0-based) → letras de coluna: 0 → A, 25 → Z, 26 → AA. Só dentro dos limites do Excel. */
function columnName(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > MAX_COLUMN_INDEX) {
    throw new XlsxError("A planilha tem mais colunas do que o formato permite.");
  }
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/**
 * Valida e decompõe a referência de uma célula (`D2`). Referência absurda vinda do
 * arquivo lança erro — antes, uma coluna com centenas de letras virava `Infinity` e
 * travava o processo num laço sem fim.
 */
function parseCellRef(ref: string): { column: number; row: number } {
  const match = CELL_REF.exec(ref);
  if (match) {
    let column = -1;
    for (const ch of match[1].toUpperCase()) column = (column + 1) * 26 + (ch.charCodeAt(0) - 65);
    const row = Number(match[2]);
    if (column <= MAX_COLUMN_INDEX && row >= 1 && row <= MAX_ROW) return { column, row };
  }
  throw new XlsxError(`Referência de célula inválida: "${ref.slice(0, 20)}".`);
}

/** Texto de célula: `_xHHHH_` (escape do Excel para caracteres de controle), NFC, sem espaços nas pontas. */
const clean = (text: string) =>
  text.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).normalize("NFC").trim();

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
  if (sheetEntries.length > MAX_SHEETS) {
    throw new XlsxError(`O arquivo tem mais de ${MAX_SHEETS} abas, mais do que o app lê.`);
  }

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

  const stylesDeclared = [...relations.values()].some((r) => r.type.endsWith(REL_TYPE.styles));
  const stylesXml = await readXml(zip, partOf(REL_TYPE.styles, "xl/styles.xml"));
  // Sem os estilos, datas virariam números em silêncio.
  if (stylesDeclared && !stylesXml) throw new XlsxError("A parte de estilos citada no pacote não foi encontrada.");
  const styleSheet = stylesXml?.styleSheet as XmlNode | undefined;
  // Decide "é data?" uma vez por formato, e não uma vez por estilo que o usa.
  const dateFormats = new Map<number, boolean>();
  for (const fmt of ((styleSheet?.numFmts as XmlNode | undefined)?.numFmt as XmlNode[] | undefined) ?? []) {
    dateFormats.set(Number(fmt["@_numFmtId"]), isDateFormatCode(String(fmt["@_formatCode"] ?? "")));
  }
  const dateStyles = new Set<number>();
  (((styleSheet?.cellXfs as XmlNode | undefined)?.xf as XmlNode[] | undefined) ?? []).forEach((xf, index) => {
    const id = Number(xf["@_numFmtId"] ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || dateFormats.get(id) === true) dateStyles.add(index);
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
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > MAX_ROW) {
      throw new XlsxError(`Número de linha inválido na aba "${name}".`);
    }
    previousRow = rowNumber;
    const cells: CellValue[] = [];
    let previousColumn = -1;
    for (const c of (rowNode.c as XmlNode[] | undefined) ?? []) {
      const ref = c["@_r"] !== undefined ? String(c["@_r"]) : `${columnName(previousColumn + 1)}${rowNumber}`;
      previousColumn = parseCellRef(ref).column;
      const value = readCell(c, ref.toUpperCase(), context);
      if (value) cells.push(value);
    }
    if (cells.length === 0) continue;

    if (header === null) {
      header = uniqueLabels(cells.map((cell) => cell.text));
      cells.forEach((cell, i) => columns.set(columnOf(cell.address), header![i]));
      continue;
    }
    // Sem protótipo: um cabeçalho "__proto__" vira uma coluna comum.
    const record = Object.create(null) as Record<string, CellValue>;
    for (const cell of cells) {
      const column = columnOf(cell.address);
      // Coluna sem cabeçalho: `#E`, para não colidir com um cabeçalho de texto "E".
      record[columns.get(column) ?? `#${column}`] = cell;
    }
    rows.push({ rowNumber, cells: record });
  }

  return { name, header: header ?? [], rows };
}

const columnOf = (address: string) => address.replace(/\d+/g, "");

/**
 * Cabeçalhos únicos: repetidos viram "Nome (2)", "Nome (3)"… sem colidir com um
 * cabeçalho existente. Linear: o próximo sufixo de cada nome é lembrado.
 */
function uniqueLabels(texts: string[]): string[] {
  const used = new Set<string>();
  const nextSuffix = new Map<string, number>();
  return texts.map((text) => {
    let label = text;
    if (used.has(label)) {
      let n = nextSuffix.get(text) ?? 2;
      while (used.has(`${text} (${n})`)) n++;
      label = `${text} (${n})`;
      nextSuffix.set(text, n + 1);
    }
    used.add(label);
    return label;
  });
}

function readCell(c: XmlNode, address: string, context: CellContext): CellValue | null {
  const type = String(c["@_t"] ?? "n");
  const style = Number(c["@_s"] ?? 0);
  const raw = asText(c.v);

  // Fórmula sem valor calculado (arquivo salvo sem recalcular): o valor é
  // desconhecido, não vazio (F2.8). Resultado de texto vazio (`t="str"` com `<v></v>`,
  // ex. `=SE(...;"";...)`) é legítimo e vira célula vazia.
  const emptyTextResult = (type === "str" || type === "e") && c.v !== undefined;
  if ("f" in c && raw.trim() === "" && type !== "inlineStr" && !emptyTextResult) {
    throw new XlsxError(
      `A célula ${address} tem uma fórmula sem valor calculado. Abra e salve a planilha no Excel ou no Google Planilhas.`,
    );
  }

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
