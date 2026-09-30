import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { fixtureBytes } from "../../../tests/helpers/fixtures";
import { contentHash } from "./normalize";
import { extractXlsx } from "./xlsx";

describe("extractXlsx", () => {
  it("lê a aba Atividades do registro inicial com datas puras", async () => {
    const result = await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx"));
    expect(result.sheets.map((s) => s.name)).toEqual(["Atividades"]);
    const [sheet] = result.sheets;
    expect(sheet.header).toEqual([
      "ID",
      "Atividade",
      "Responsáveis",
      "Prazo",
      "Frente",
      "Prioridade",
      "Status",
      "Próximo passo",
      "Origem",
      "Notas e bloqueios",
    ]);
    expect(sheet.rows.map((r) => r.cells.ID.text)).toEqual(["ACT-101", "ACT-102", "ACT-103", "ACT-104"]);
    expect(sheet.rows.map((r) => r.cells.Prazo.date)).toEqual(["2026-10-05", "2026-10-06", "2026-10-09", "2026-10-11"]);
    expect(sheet.rows[3].cells["Responsáveis"].text).toBe("Ana; Davi");
    expect(sheet.rows[2].cells.Status.text).toBe("Bloqueada");
    expect(sheet.rows[0].cells.Prazo.address).toBe("D2");
  });

  it("planilha homônima vazia: aba Ata, cabeçalho e zero linhas de dados", async () => {
    const result = await extractXlsx(fixtureBytes("03_CONFLITO/Ata - copia vazia.xlsx"));
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe("Ata");
    expect(result.sheets[0].header).toContain("ID");
    expect(result.sheets[0].rows).toHaveLength(0);
  });

  it("a mesma planilha sempre gera o mesmo hash", async () => {
    const a = await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx"));
    const b = await extractXlsx(fixtureBytes("01_CARGA_INICIAL/Ata_registro.xlsx"));
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it("também lê planilhas no estilo do Excel (sem prefixo, shared strings, data nativa)", async () => {
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tarefas" sheetId="1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file(
      "xl/sharedStrings.xml",
      '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>ID</t></si><si><t>Prazo</t></si><si><r><t>TASK</t></r><r><t>-7</t></r></si></sst>',
    );
    zip.file(
      "xl/styles.xml",
      '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>46300</v></c></row></sheetData></worksheet>',
    );
    const result = await extractXlsx(await zip.generateAsync({ type: "uint8array" }));
    expect(result.sheets[0]).toMatchObject({ name: "Tarefas", header: ["ID", "Prazo"] });
    expect(result.sheets[0].rows[0].cells.ID.text).toBe("TASK-7");
    expect(result.sheets[0].rows[0].cells.Prazo.date).toBe("2026-10-05");
  });

  it("arquivo corrompido lança erro (nunca vira planilha vazia)", async () => {
    await expect(extractXlsx(new TextEncoder().encode("isto não é um xlsx"))).rejects.toThrow();
  });
});

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const WORKBOOK = `<?xml version="1.0"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tarefas" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const RELS =
  '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
const STYLES = `<?xml version="1.0"?><styleSheet ${NS}><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="20"/><xf numFmtId="46"/></cellXfs></styleSheet>`;

/** Monta um .xlsx mínimo; `parts` substitui ou remove (null) partes do pacote. */
async function buildXlsx(sheetData: string, parts: Record<string, string | null> = {}) {
  const files: Record<string, string | null> = {
    "xl/workbook.xml": WORKBOOK,
    "xl/_rels/workbook.xml.rels": RELS,
    "xl/styles.xml": STYLES,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet ${NS}><sheetData>${sheetData}</sheetData></worksheet>`,
    ...parts,
  };
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) if (content !== null) zip.file(path, content);
  return zip.generateAsync({ type: "uint8array" });
}

const inline = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;

describe("extractXlsx — robustez (F2.8: falha de leitura nunca vira vazio)", () => {
  it("lê XML indentado (texto de formatação entre elementos)", async () => {
    const sst = `<?xml version="1.0"?>\n<sst ${NS}>\n  <si>\n    <t>ID</t>\n  </si>\n  <si>\n    <t>ACT-9</t>\n  </si>\n</sst>`;
    const data = await buildXlsx(
      '\n  <row r="1">\n    <c r="A1" t="s"><v>0</v></c>\n    <c r="B1" t="inlineStr">\n      <is>\n        <t>Nome</t>\n      </is>\n    </c>\n  </row>\n  <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="inlineStr"><is><t>Ana</t></is></c></row>\n',
      { "xl/sharedStrings.xml": sst },
    );
    const [sheet] = (await extractXlsx(data)).sheets;
    expect(sheet.header).toEqual(["ID", "Nome"]);
    expect(sheet.rows[0].cells.ID.text).toBe("ACT-9");
    expect(sheet.rows[0].cells.Nome.text).toBe("Ana");
  });

  it("aba sem relacionamento, parte ausente ou XML inválido lançam erro", async () => {
    const row = `<row r="1">${inline("A1", "ID")}</row>`;
    await expect(extractXlsx(await buildXlsx(row, { "xl/_rels/workbook.xml.rels": null }))).rejects.toThrow();
    await expect(extractXlsx(await buildXlsx(row, { "xl/worksheets/sheet1.xml": null }))).rejects.toThrow();
    await expect(extractXlsx(await buildXlsx(row, { "xl/worksheets/sheet1.xml": "<worksheet><sheetData><row" }))).rejects.toThrow();
  });

  it("shared string inexistente lança erro em vez de sumir com a célula", async () => {
    const data = await buildXlsx('<row r="1"><c r="A1" t="s"><v>0</v></c></row>');
    await expect(extractXlsx(data)).rejects.toThrow();
  });

  it("cabeçalhos repetidos ou com nomes especiais não sobrescrevem colunas", async () => {
    const data = await buildXlsx(
      `<row r="1">${inline("A1", "Responsável")}${inline("B1", "Responsável")}${inline("C1", "__proto__")}</row>` +
        `<row r="2">${inline("A2", "Ana")}${inline("B2", "Davi")}${inline("C2", "x")}</row>`,
    );
    const [sheet] = (await extractXlsx(data)).sheets;
    expect(sheet.header).toEqual(["Responsável", "Responsável (2)", "__proto__"]);
    expect(sheet.rows[0].cells["Responsável"].text).toBe("Ana");
    expect(sheet.rows[0].cells["Responsável (2)"].text).toBe("Davi");
    expect(Object.keys(sheet.rows[0].cells)).toContain("__proto__");
  });

  it("formatos personalizados: só hora não vira data; dia, mês e ano viram", async () => {
    const styles =
      `<?xml version="1.0"?><styleSheet ${NS}><numFmts count="6">` +
      '<numFmt numFmtId="164" formatCode="hh:mm"/><numFmt numFmtId="165" formatCode="mm:ss"/>' +
      '<numFmt numFmtId="166" formatCode="h:mm AM/PM"/><numFmt numFmtId="167" formatCode="[$-F400]h:mm:ss AM/PM"/>' +
      '<numFmt numFmtId="168" formatCode="dd/mm/yyyy"/><numFmt numFmtId="169" formatCode="mmm-yy"/></numFmts>' +
      '<cellXfs count="7"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="166"/>' +
      '<xf numFmtId="167"/><xf numFmtId="168"/><xf numFmtId="169"/></cellXfs></styleSheet>';
    const heads = ["A", "B", "C", "D", "E", "F"];
    const data = await buildXlsx(
      `<row r="1">${heads.map((h, i) => inline(`${h}1`, `c${i + 1}`)).join("")}</row>` +
        `<row r="2">${heads.map((h, i) => `<c r="${h}2" s="${i + 1}"><v>46300.375</v></c>`).join("")}</row>`,
      { "xl/styles.xml": styles },
    );
    const cells = (await extractXlsx(data)).sheets[0].rows[0].cells;
    expect([cells.c1.date, cells.c2.date, cells.c3.date, cells.c4.date]).toEqual([undefined, undefined, undefined, undefined]);
    expect(cells.c5.date).toBe("2026-10-05");
    expect(cells.c6.date).toBe("2026-10-05");
  });

  it("pasta de trabalho sem nenhuma aba é inválida", async () => {
    const empty = WORKBOOK.replace(/<sheets>.*<\/sheets>/, "<sheets></sheets>");
    await expect(extractXlsx(await buildXlsx("", { "xl/workbook.xml": empty }))).rejects.toThrow();
  });

  it("aba de gráfico é ignorada sem derrubar a leitura das planilhas", async () => {
    const workbook = WORKBOOK.replace(
      "</sheets>",
      '<sheet name="Gráfico" sheetId="2" r:id="rId2"/></sheets>',
    );
    const rels = RELS.replace(
      "</Relationships>",
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet" Target="chartsheets/sheet1.xml"/></Relationships>',
    );
    const data = await buildXlsx(`<row r="1">${inline("A1", "ID")}</row>`, {
      "xl/workbook.xml": workbook,
      "xl/_rels/workbook.xml.rels": rels,
    });
    expect((await extractXlsx(data)).sheets.map((s) => s.name)).toEqual(["Tarefas"]);
  });

  it("datas impossíveis não viram data (t=\"d\" inválido, serial fora do calendário)", async () => {
    const data = await buildXlsx(
      `<row r="1">${inline("A1", "ISO")}${inline("B1", "Serial")}</row>` +
        '<row r="2"><c r="A2" t="d"><v>2026-13-45T00:00:00</v></c><c r="B2" s="1"><v>99999999</v></c></row>',
    );
    const cells = (await extractXlsx(data)).sheets[0].rows[0].cells;
    expect(cells.ISO.date).toBeUndefined();
    expect(cells.Serial.date).toBeUndefined();
  });

  it("desambiguação de cabeçalhos nunca colide", async () => {
    const data = await buildXlsx(
      `<row r="1">${inline("A1", "Nome")}${inline("B1", "Nome")}${inline("C1", "Nome (2)")}</row>` +
        `<row r="2">${inline("A2", "a")}${inline("B2", "b")}${inline("C2", "c")}</row>`,
    );
    const [sheet] = (await extractXlsx(data)).sheets;
    expect(new Set(sheet.header).size).toBe(3);
    expect(Object.values(sheet.rows[0].cells).map((c) => c.text).sort()).toEqual(["a", "b", "c"]);
  });

  it("formatos só de hora não viram data; t=\"d\" e célula s sem valor são tratados", async () => {
    const data = await buildXlsx(
      `<row r="1">${inline("A1", "Data")}${inline("B1", "Hora")}${inline("C1", "Duração")}${inline("D1", "ISO")}${inline("E1", "Vazia")}</row>` +
        '<row r="2"><c r="A2" s="1"><v>46300</v></c><c r="B2" s="2"><v>0.5</v></c><c r="C2" s="3"><v>0.25</v></c><c r="D2" t="d"><v>2026-10-07T00:00:00</v></c><c r="E2" t="s"/></row>',
    );
    const cells = (await extractXlsx(data)).sheets[0].rows[0].cells;
    expect(cells.Data.date).toBe("2026-10-05");
    expect(cells.Hora.date).toBeUndefined();
    expect(cells.Duração.date).toBeUndefined();
    expect(cells.ISO.date).toBe("2026-10-07");
    expect(cells.Vazia).toBeUndefined();
  });
});
