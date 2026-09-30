import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FakeDriveGateway } from "./fake-drive-gateway";

/** Copia uma pasta do disco para o Drive falso, preservando subpastas. */
export function seedFakeDriveFromDir(drive: FakeDriveGateway, dir: string, parentId = drive.rootId) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      seedFakeDriveFromDir(drive, path, drive.addFolder(name, parentId));
    } else {
      drive.addFile({ name, content: new Uint8Array(readFileSync(path)), parentId });
    }
  }
}

/**
 * Cenário de demonstração/teste: a carga inicial do pacote da banca com a ata de
 * 01/10 dentro de uma subpasta `Atas` (testa a leitura recursiva, CA-F2.1).
 */
export function createInitialLoadDrive(dataDir: string) {
  const drive = new FakeDriveGateway();
  const base = join(dataDir, "01_CARGA_INICIAL");
  const ids: Record<string, string> = {};
  for (const name of ["INDEX.md", "ESTADO-ATUAL.md", "GUIA_INICIAL.md", "PLANO_EDITORIAL_ANTIGO.md", "Ata_registro.xlsx"]) {
    ids[name] = drive.addFile({ name, content: new Uint8Array(readFileSync(join(base, name))) });
  }
  ids.Atas = drive.addFolder("Atas");
  ids["Ata_2026-10-01.md"] = drive.addFile({
    name: "Ata_2026-10-01.md",
    content: new Uint8Array(readFileSync(join(base, "Ata_2026-10-01.md"))),
    parentId: ids.Atas,
  });
  return { drive, ids };
}
