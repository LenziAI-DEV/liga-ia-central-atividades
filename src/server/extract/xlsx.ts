import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { isoDateFromUtcParts } from "@/lib/datetime";
import type { CellValue, Sheet, SheetExtract, SheetRow } from "./types";

/**
 * Leitor de `.xlsx` próprio (JSZip + parser XML sem prefixos de namespace).
 * Motivo: a planilha do pacote da banca é gerada pelo OpenXML SDK com prefixo
 * `x:` nos elementos, caminhos absolutos nos `.rels` e BOM — formatos que o exceljs
 * não lê. Este leitor aceita esse estilo e o do Excel (DEC-011).
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

/** Formatos de data embutidos do Excel (numFmtId). */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function asText(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(asText).join("");
  const obj = node as XmlNode;
  if ("#text" in obj) return asText(obj["#text"]);
  if ("t" in obj) return asText(obj.t);
  if ("r" in obj) return asText(obj.r);
  return "";
}

function isDateFormatCode(code: string): boolean {
  const cleaned = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
  return /[dy]/i.test(cleaned) || /(^|[^h:])m{1,4}(?![:s])/i.test(cleaned);
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

async function readXml(zip: JSZip, path: string): Promise<XmlNode | null> {
  const file = zip.file(path) ?? zip.file(path.replace(/^\//, ""));
  if (!file) return null;
  const xml = (await file.async("string")).replace(/^﻿/, "");
  return parser.parse(xml) as XmlNode;
}

function serialToIsoDate(serial: number, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return isoDateFromUtcParts(new Date(epoch + Math.round(serial * 86_400_000)));
}

function columnOf(ref: string): string {
  return ref.replace(/\d+/g, "");
}

/**
 * Lê todas as abas: a primeira linha com conteúdo é o cabeçalho; as seguintes com
 * pelo menos uma célula preenchida são dados. Linhas só com formatação (como na
 * planilha vazia de conflito) são ignoradas. Arquivo inválido lança erro — nunca
 * vira "planilha vazia" (AR-16).
 */
export async function extractXlsx(data: Uint8Array): Promise<SheetExtract> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch (error) {
    throw new Error("Arquivo .xlsx inválido ou corrompido.", { cause: error });
  }

  const workbookXml = await readXml(zip, "xl/workbook.xml");
  const workbook = workbookXml?.workbook as XmlNode | undefined;
  if (!workbook) throw new Error("Arquivo .xlsx sem workbook.xml legível.");

  const date1904 = ["1", "true"].includes(String((workbook.workbookPr as XmlNode | undefined)?.["@_date1904"] ?? ""));

  const relsXml = await readXml(zip, "xl/_rels/workbook.xml.rels");
  const relations = new Map<string, string>();
  for (const rel of ((relsXml?.Relationships as XmlNode | undefined)?.Relationship as XmlNode[] | undefined) ?? []) {
    relations.set(String(rel["@_Id"]), resolveTarget(String(rel["@_Target"])));
  }

  const sstXml = await readXml(zip, "xl/sharedStrings.xml");
  const sharedStrings = (((sstXml?.sst as XmlNode | undefined)?.si as unknown[] | undefined) ?? []).map(asText);

  const stylesXml = await readXml(zip, "xl/styles.xml");
  const styleSheet = stylesXml?.styleSheet as XmlNode | undefined;
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

  const sheetEntries = ((workbook.sheets as XmlNode | undefined)?.sheet as XmlNode[] | undefined) ?? [];
  const sheets: Sheet[] = [];

  for (const entry of sheetEntries) {
    const name = String(entry["@_name"] ?? "");
    const target = relations.get(String(entry["@_id"] ?? ""));
    const sheetXml = target ? await readXml(zip, target) : null;
    const sheetData = (sheetXml?.worksheet as XmlNode | undefined)?.sheetData as XmlNode | undefined;
    const rowNodes = (sheetData?.row as XmlNode[] | undefined) ?? [];

    let header: string[] | null = null;
    const columns = new Map<string, string>();
    const rows: SheetRow[] = [];

    for (const rowNode of rowNodes) {
      const rowNumber = Number(rowNode["@_r"]);
      const cells: CellValue[] = [];
      for (const c of (rowNode.c as XmlNode[] | undefined) ?? []) {
        const value = readCell(c, sharedStrings, dateStyles, date1904);
        if (value) cells.push(value);
      }
      if (cells.length === 0) continue;

      if (header === null) {
        header = cells.map((cell) => {
          columns.set(columnOf(cell.address), cell.text);
          return cell.text;
        });
        continue;
      }
      const record: Record<string, CellValue> = {};
      for (const cell of cells) record[columns.get(columnOf(cell.address)) ?? columnOf(cell.address)] = cell;
      rows.push({ rowNumber, cells: record });
    }

    sheets.push({ name, header: header ?? [], rows });
  }

  return { kind: "sheet", sheets };
}

function readCell(c: XmlNode, sharedStrings: string[], dateStyles: Set<number>, date1904: boolean): CellValue | null {
  const address = String(c["@_r"] ?? "");
  const type = String(c["@_t"] ?? "n");
  const style = Number(c["@_s"] ?? 0);
  const raw = asText(c.v);

  if (type === "s") {
    const text = (sharedStrings[Number(raw)] ?? "").trim();
    return text ? { address, text, raw: text } : null;
  }
  if (type === "inlineStr") {
    const text = asText(c.is).trim();
    return text ? { address, text, raw: text } : null;
  }
  if (type === "str" || type === "e") {
    const text = raw.trim();
    return text ? { address, text, raw: text } : null;
  }
  if (type === "b") return raw === "" ? null : { address, text: raw === "1" ? "VERDADEIRO" : "FALSO", raw: raw === "1" };

  if (raw.trim() === "") return null;
  const number = Number(raw);
  if (Number.isNaN(number)) return { address, text: raw.trim(), raw: raw.trim() };
  if (dateStyles.has(style)) {
    const date = serialToIsoDate(number, date1904);
    return { address, text: date, raw: number, date };
  }
  return { address, text: String(number), raw: number };
}
