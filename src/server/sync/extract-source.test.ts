import { describe, expect, it } from "vitest";
import { FakeDriveGateway } from "@/server/drive/fake-drive-gateway";
import { MIME } from "@/server/drive/gateway";
import { extractSource } from "./extract-source";

const MAX = 10 * 1024 * 1024;

async function item(drive: FakeDriveGateway, id: string) {
  return drive.getItem(id);
}

describe("extractSource", () => {
  it("Markdown em UTF-8 é lido como está", async () => {
    const drive = new FakeDriveGateway();
    const id = drive.addFile({ name: "ata.md", content: "# Reunião\n\nstatus: ativo" });
    const doc = await extractSource(drive, await item(drive, id), "md", MAX);
    expect(doc).toMatchObject({ kind: "text", title: "Reunião" });
  });

  it("Markdown em Windows-1252 não vira texto com caracteres trocados", async () => {
    const drive = new FakeDriveGateway();
    // "# Reunião" em Windows-1252: ã = 0xE3 (byte inválido isolado em UTF-8).
    const bytes = new Uint8Array([0x23, 0x20, 0x52, 0x65, 0x75, 0x6e, 0x69, 0xe3, 0x6f]);
    const id = drive.addFile({ name: "ata.md", content: bytes });
    const doc = await extractSource(drive, await item(drive, id), "md", MAX);
    expect(doc.kind === "text" && doc.title).toBe("Reunião");
    expect(doc.kind === "text" && doc.text).not.toContain("�");
  });

  it("Google Doc: se o export em Markdown falha de forma não fatal, usa texto simples", async () => {
    const drive = new FakeDriveGateway();
    const id = drive.addFile({ name: "Ata", mimeType: MIME.gdoc, content: "# Ata\n\ntexto" });
    drive.failNext("exportDoc", id, "unknown");
    const doc = await extractSource(drive, await item(drive, id), "gdoc", MAX);
    expect(doc).toMatchObject({ kind: "text", title: "Ata" });
    expect(drive.calls.exportDoc).toBe(2);
  });

  it("Google Doc: erro fatal (limite, sem acesso) não tenta o fallback", async () => {
    const drive = new FakeDriveGateway();
    const id = drive.addFile({ name: "Ata", mimeType: MIME.gdoc, content: "x" });
    drive.failNext("exportDoc", id, "too_large");
    await expect(extractSource(drive, await item(drive, id), "gdoc", MAX)).rejects.toMatchObject({ kind: "too_large" });
    expect(drive.calls.exportDoc).toBe(1);
  });
});
