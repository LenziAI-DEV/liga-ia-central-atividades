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
