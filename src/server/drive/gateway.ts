/** Tipos MIME relevantes do Google Drive. */
export const MIME = {
  folder: "application/vnd.google-apps.folder",
  gdoc: "application/vnd.google-apps.document",
  gsheet: "application/vnd.google-apps.spreadsheet",
  shortcut: "application/vnd.google-apps.shortcut",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  markdown: "text/markdown",
} as const;

/** Metadados de um item do Drive usados pela aplicação ([GUIA §7]). */
export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  /** Número de versão do Drive: muda a cada alteração (inclusive renomear). */
  version: string | null;
  size: number | null;
  md5Checksum: string | null;
  parents: string[];
  webViewLink: string | null;
  trashed: boolean;
  canDownload: boolean;
}

export interface DriveAccount {
  displayName: string | null;
  email: string | null;
}

/**
 * Porta de acesso ao Drive, somente leitura (AR-9): não existe método de escrita.
 * Implementações: Google real, falsa (testes/E2E).
 */
export interface DriveGateway {
  getItem(fileId: string): Promise<DriveItem>;
  listChildren(folderId: string, pageToken?: string): Promise<{ items: DriveItem[]; nextPageToken?: string }>;
  /** Conteúdo de arquivo binário (`.md`, `.xlsx`) — `files.get` com `alt=media`. */
  download(fileId: string, maxBytes: number): Promise<Uint8Array>;
  /** Conteúdo de Google Doc nativo — `files.export` (limite de 10 MB). */
  exportDoc(fileId: string, mimeType: "text/markdown" | "text/plain"): Promise<string>;
  getAccount(): Promise<DriveAccount>;
}
