import { describe, expect, it } from "vitest";
import { FakeDriveGateway } from "./fake-drive-gateway";
import { walkTree } from "./walk-tree";

describe("walkTree", () => {
  it("percorre subpastas em vários níveis e monta o caminho", async () => {
    const drive = new FakeDriveGateway();
    const atas = drive.addFolder("Atas");
    const antigas = drive.addFolder("Antigas", atas);
    drive.addFile({ name: "INDEX.md", content: "# Índice" });
    drive.addFile({ name: "Ata_2026-10-01.md", content: "# Ata", parentId: atas });
    drive.addFile({ name: "Ata_2026-09-01.md", content: "# Ata", parentId: antigas });

    const result = await walkTree(drive, drive.rootId);
    expect(result.items.map((i) => i.path).sort()).toEqual([
      "Atas",
      "Atas/Antigas",
      "Atas/Antigas/Ata_2026-09-01.md",
      "Atas/Ata_2026-10-01.md",
      "INDEX.md",
    ]);
    expect(result.listedFolders).toEqual(new Set([drive.rootId, atas, antigas]));
  });

  it("percorre todas as páginas da listagem", async () => {
    const drive = new FakeDriveGateway({ pageSize: 2 });
    for (let i = 0; i < 5; i++) drive.addFile({ name: `f${i}.md`, content: "x" });
    const result = await walkTree(drive, drive.rootId);
    expect(result.items).toHaveLength(5);
    expect(drive.calls.listChildren).toBe(3);
  });

  it("ignora itens na lixeira", async () => {
    const drive = new FakeDriveGateway();
    const id = drive.addFile({ name: "apagado.md", content: "x" });
    drive.trash(id);
    expect((await walkTree(drive, drive.rootId)).items).toHaveLength(0);
  });

  it("isola falha de listagem numa subpasta", async () => {
    const drive = new FakeDriveGateway();
    const atas = drive.addFolder("Atas");
    drive.addFile({ name: "a.md", content: "x", parentId: atas });
    drive.addFile({ name: "INDEX.md", content: "x" });
    drive.failNext("listChildren", atas, "transient");
    const result = await walkTree(drive, drive.rootId);
    expect(result.failedFolders.has(atas)).toBe(true);
    expect(result.listedFolders.has(atas)).toBe(false);
    expect(result.items.map((i) => i.name)).toContain("INDEX.md");
  });

  it("pasta com dois pais (pasta repetida) aparece e é percorrida uma vez só", async () => {
    const drive = new FakeDriveGateway();
    const a = drive.addFolder("A");
    const b = drive.addFolder("B");
    drive.addFile({ name: "x.md", content: "x", parentId: b });
    drive.addParent(b, a);
    const result = await walkTree(drive, drive.rootId);
    expect(result.items.filter((i) => i.id === b)).toHaveLength(1);
    expect(result.items.filter((i) => i.name === "x.md")).toHaveLength(1);
  });

  it("interrompe em erro de autenticação", async () => {
    const drive = new FakeDriveGateway();
    drive.revokeAll();
    await expect(walkTree(drive, drive.rootId)).rejects.toMatchObject({ kind: "auth" });
  });
});
