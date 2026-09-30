import { DriveError } from "./errors";
import { MIME, type DriveGateway, type DriveItem } from "./gateway";

export interface WalkedItem extends DriveItem {
  /** Caminho relativo à pasta raiz, ex.: `Atas/Ata_2026-10-01.md`. */
  path: string;
  parentId: string;
}

export interface WalkResult {
  items: WalkedItem[];
  /** Pastas listadas por completo neste ciclo (inclui a raiz). */
  listedFolders: Set<string>;
  /** Pastas cuja listagem falhou: nada sob elas pode ser dado como removido (AR-16). */
  failedFolders: Map<string, DriveError>;
}

/**
 * Percorre a pasta raiz e todas as subpastas em largura, com paginação e conjunto
 * de pastas visitadas ([GUIA §7]). Nunca sai da árvore. Erro de autenticação
 * interrompe tudo; erro numa subpasta é isolado.
 */
export async function walkTree(gateway: DriveGateway, rootId: string): Promise<WalkResult> {
  const items: WalkedItem[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>([rootId]);
  const listedFolders = new Set<string>();
  const failedFolders = new Map<string, DriveError>();
  const queue: Array<{ id: string; path: string }> = [{ id: rootId, path: "" }];

  while (queue.length > 0) {
    const folder = queue.shift()!;
    const children: DriveItem[] = [];
    try {
      let pageToken: string | undefined;
      do {
        const page = await gateway.listChildren(folder.id, pageToken);
        children.push(...page.items);
        pageToken = page.nextPageToken;
      } while (pageToken);
    } catch (error) {
      if (error instanceof DriveError && error.kind !== "auth" && folder.id !== rootId) {
        failedFolders.set(folder.id, error);
        continue;
      }
      throw error;
    }
    listedFolders.add(folder.id);

    for (const child of children) {
      if (child.trashed || seen.has(child.id)) continue;
      seen.add(child.id);
      const path = folder.path ? `${folder.path}/${child.name}` : child.name;
      items.push({ ...child, path, parentId: folder.id });
      if (child.mimeType === MIME.folder && !visited.has(child.id)) {
        visited.add(child.id);
        queue.push({ id: child.id, path });
      }
    }
  }

  return { items, listedFolders, failedFolders };
}
