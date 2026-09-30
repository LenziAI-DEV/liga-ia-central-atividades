import { describe, expect, it } from "vitest";
import { classifyFile } from "./classify-file";
import { MIME } from "./gateway";

describe("classifyFile", () => {
  it.each([
    ["INDEX.md", "text/markdown", "md"],
    ["INDEX.md", "text/plain", "md"],
    ["INDEX.md", "application/octet-stream", "md"],
    ["Ata_registro.xlsx", MIME.xlsx, "xlsx"],
    ["Ata_registro.xlsx", "application/octet-stream", "xlsx"],
    ["Ata_2026-10-03", MIME.gdoc, "gdoc"],
    ["Atas", MIME.folder, "folder"],
  ])("%s (%s) → %s", (name, mimeType, kind) => {
    expect(classifyFile({ name, mimeType }).kind).toBe(kind);
  });

  it("não processa .docx e explica como converter (CA-F2.2)", () => {
    const c = classifyFile({ name: "Ata_2026-10-03.docx", mimeType: MIME.docx });
    expect(c.kind).toBe("unsupported");
    expect(c.reason).toMatch(/Formato ainda não processado: \.docx/);
  });

  it("não processa imagem nem inventa conteúdo", () => {
    const c = classifyFile({ name: "foto.png", mimeType: "image/png" });
    expect(c).toEqual({ kind: "unsupported", reason: expect.stringMatching(/imagem/) });
  });

  it("Planilha Google nativa fica como não processada, com orientação", () => {
    expect(classifyFile({ name: "Ata_registro", mimeType: MIME.gsheet }).reason).toMatch(/Converter uploads/);
  });

  it("atalho não é seguido", () => {
    expect(classifyFile({ name: "link", mimeType: MIME.shortcut }).kind).toBe("shortcut");
  });

  it("texto que não é .md não é tratado como markdown", () => {
    expect(classifyFile({ name: "notas.txt", mimeType: "text/plain" }).kind).toBe("unsupported");
  });
});
