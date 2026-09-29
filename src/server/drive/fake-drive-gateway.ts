import { DriveError, type DriveErrorKind } from "./errors";
import { MIME, type DriveAccount, type DriveGateway, type DriveItem } from "./gateway";

type Operation = "getItem" | "listChildren" | "download" | "exportDoc";

interface FakeEntry {
  item: DriveItem;
  content?: Uint8Array;
  accessRevoked?: boolean;
}

const MIME_BY_EXT: Record<string, string> = {
  md: "text/markdown",
  xlsx: MIME.xlsx,
  docx: MIME.docx,
  pdf: MIME.pdf,
  png: "image/png",
  txt: "text/plain",
};

/**
 * Drive em memória para testes e para o modo `DRIVE_MODE=fake` (ADR-17).
 * Simula versões, lixeira, renomeação, perda de acesso, falhas e paginação.
 */
export class FakeDriveGateway implements DriveGateway {
  readonly rootId: string;
  readonly calls: Record<Operation, number> = { getItem: 0, listChildren: 0, download: 0, exportDoc: 0 };
  private readonly entries = new Map<string, FakeEntry>();
  private readonly pageSize: number;
  private readonly failures = new Map<string, DriveErrorKind>();
  private offline = false;
  private revoked = false;
  private seq = 0;
  private clock = Date.parse("2026-09-29T12:00:00Z");

  constructor(options: { rootName?: string; pageSize?: number } = {}) {
    this.pageSize = options.pageSize ?? 1000;
    this.rootId = "root-folder";
    this.entries.set(this.rootId, { item: this.makeItem(this.rootId, options.rootName ?? "LIA case teste", MIME.folder, []) });
  }

  // ---------- manipulação do cenário ----------

  addFolder(name: string, parentId = this.rootId): string {
    const id = this.nextId("folder");
    this.entries.set(id, { item: this.makeItem(id, name, MIME.folder, [parentId]) });
    return id;
  }

  addFile(file: { name: string; content: string | Uint8Array; parentId?: string; mimeType?: string; id?: string }): string {
    const id = file.id ?? this.nextId("file");
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const mimeType = file.mimeType ?? MIME_BY_EXT[ext] ?? "application/octet-stream";
    const content = typeof file.content === "string" ? new TextEncoder().encode(file.content) : file.content;
    const item = this.makeItem(id, file.name, mimeType, [file.parentId ?? this.rootId]);
    item.size = mimeType === MIME.gdoc ? null : content.byteLength;
    this.entries.set(id, { item, content });
    return id;
  }

  editContent(id: string, content: string | Uint8Array) {
    const entry = this.require(id);
    entry.content = typeof content === "string" ? new TextEncoder().encode(content) : content;
    this.bump(entry.item);
  }

  rename(id: string, name: string) {
    const entry = this.require(id);
    entry.item.name = name;
    this.bump(entry.item);
  }

  trash(id: string) {
    const entry = this.require(id);
    entry.item.trashed = true;
    this.bump(entry.item);
  }

  remove(id: string) {
    this.entries.delete(id);
  }

  revokeAccess(id: string) {
    this.require(id).accessRevoked = true;
  }

  moveOut(id: string) {
    const entry = this.require(id);
    entry.item.parents = ["pasta-fora-do-escopo"];
    this.bump(entry.item);
  }

  /** Próxima chamada `operation` sobre `id` falha com `kind` (uma vez). */
  failNext(operation: Operation, id: string, kind: DriveErrorKind) {
    this.failures.set(`${operation}:${id}`, kind);
  }

  setOffline(offline: boolean) {
    this.offline = offline;
  }

  revokeAll() {
    this.revoked = true;
  }

  restoreAccess() {
    this.revoked = false;
  }

  // ---------- DriveGateway ----------

  async getItem(fileId: string): Promise<DriveItem> {
    this.check("getItem", fileId);
    const entry = this.entries.get(fileId);
    if (!entry || entry.accessRevoked) throw new DriveError("not_found", "Arquivo não encontrado ou sem acesso.");
    return { ...entry.item, parents: [...entry.item.parents] };
  }

  async listChildren(folderId: string, pageToken?: string) {
    this.check("listChildren", folderId);
    const children = [...this.entries.values()]
      .filter((e) => e.item.parents.includes(folderId) && !e.item.trashed && !e.accessRevoked)
      .map((e) => ({ ...e.item, parents: [...e.item.parents] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = pageToken ? Number(pageToken) : 0;
    const items = children.slice(start, start + this.pageSize);
    const next = start + this.pageSize;
    return { items, nextPageToken: next < children.length ? String(next) : undefined };
  }

  async download(fileId: string, maxBytes: number): Promise<Uint8Array> {
    this.check("download", fileId);
    const entry = this.entries.get(fileId);
    if (!entry || entry.accessRevoked) throw new DriveError("not_found", "Arquivo não encontrado ou sem acesso.");
    if (entry.item.mimeType === MIME.gdoc) {
      throw new DriveError("not_downloadable", "Documento Google precisa ser exportado, não baixado.");
    }
    const content = entry.content ?? new Uint8Array();
    if (content.byteLength > maxBytes) throw new DriveError("too_large", "Arquivo acima do limite de tamanho.");
    return content;
  }

  async exportDoc(fileId: string): Promise<string> {
    this.check("exportDoc", fileId);
    const entry = this.entries.get(fileId);
    if (!entry || entry.accessRevoked) throw new DriveError("not_found", "Arquivo não encontrado ou sem acesso.");
    return new TextDecoder().decode(entry.content ?? new Uint8Array());
  }

  async getAccount(): Promise<DriveAccount> {
    if (this.revoked) throw new DriveError("auth", "Autorização do Google expirada ou revogada.");
    return { displayName: "Conta de teste", email: "teste@example.com" };
  }

  // ---------- internos ----------

  private check(operation: Operation, id: string) {
    this.calls[operation]++;
    if (this.revoked) throw new DriveError("auth", "Autorização do Google expirada ou revogada.");
    if (this.offline) throw new DriveError("transient", "Não foi possível falar com o Google Drive.");
    const key = `${operation}:${id}`;
    const failure = this.failures.get(key);
    if (failure) {
      this.failures.delete(key);
      throw new DriveError(failure, `Falha simulada (${failure}).`);
    }
  }

  private require(id: string): FakeEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`FakeDrive: item inexistente ${id}`);
    return entry;
  }

  private nextId(prefix: string) {
    this.seq++;
    return `${prefix}-${this.seq}`;
  }

  private tick() {
    this.clock += 60_000;
    return new Date(this.clock).toISOString();
  }

  private bump(item: DriveItem) {
    item.version = String(Number(item.version ?? "0") + 1);
    item.modifiedTime = this.tick();
  }

  private makeItem(id: string, name: string, mimeType: string, parents: string[]): DriveItem {
    return {
      id,
      name,
      mimeType,
      modifiedTime: this.tick(),
      version: "1",
      size: null,
      md5Checksum: null,
      parents,
      webViewLink: `https://drive.google.com/fake/${id}`,
      trashed: false,
      canDownload: mimeType !== MIME.folder,
    };
  }
}
