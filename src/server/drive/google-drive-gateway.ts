import "server-only";
import { drive, type drive_v3 } from "@googleapis/drive";
import type { OAuth2Client } from "google-auth-library";
import { DriveError } from "./errors";
import { MIME, type DriveAccount, type DriveGateway, type DriveItem } from "./gateway";
import { withRetry } from "./retry";

const FILE_FIELDS =
  "id,name,mimeType,modifiedTime,version,size,md5Checksum,parents,webViewLink,trashed,capabilities(canDownload)";

/** Uma chamada parada não pode segurar o ciclo (e o "Sincronizar agora") por minutos. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Motivos de 403/429 que indicam cota ou limite de uso: têm nova tentativa ([GUIA §9, §11]). */
const QUOTA_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "dailyLimitExceeded",
  "quotaExceeded",
  "sharingRateLimitExceeded",
]);

/** Implementação real, somente leitura, da porta `DriveGateway` (Drive API v3). */
export class GoogleDriveGateway implements DriveGateway {
  private readonly api: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    // `retry: false`: as novas tentativas ficam só no `withRetry` (no máximo 4 por
    // chamada, ARCHITECTURE §6.9); o retry padrão do gaxios as multiplicaria.
    this.api = drive({ version: "v3", auth, timeout: REQUEST_TIMEOUT_MS, retry: false });
  }

  async getItem(fileId: string): Promise<DriveItem> {
    const res = await call(() =>
      this.api.files.get({ fileId, fields: FILE_FIELDS, supportsAllDrives: true }),
    );
    return toItem(res.data);
  }

  async listChildren(folderId: string, pageToken?: string) {
    const res = await call(() =>
      this.api.files.list({
        q: childrenQuery(folderId),
        spaces: "drive",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: `nextPageToken, files(${FILE_FIELDS})`,
      }),
    );
    return { items: (res.data.files ?? []).map(toItem), nextPageToken: res.data.nextPageToken ?? undefined };
  }

  async download(fileId: string, maxBytes: number): Promise<Uint8Array> {
    const res = await call(() =>
      this.api.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" }),
    );
    const bytes = new Uint8Array(res.data as unknown as ArrayBuffer);
    if (bytes.byteLength > maxBytes) throw new DriveError("too_large", "Arquivo acima do limite de tamanho (10 MB).");
    return bytes;
  }

  async exportDoc(fileId: string, mimeType: "text/markdown" | "text/plain"): Promise<string> {
    const res = await call(() => this.api.files.export({ fileId, mimeType }, { responseType: "text" }));
    return String(res.data ?? "");
  }

  async getAccount(): Promise<DriveAccount> {
    const res = await call(() => this.api.about.get({ fields: "user(displayName,emailAddress)" }));
    return { displayName: res.data.user?.displayName ?? null, email: res.data.user?.emailAddress ?? null };
  }
}

/** Consulta dos filhos diretos de uma pasta; escapa `\` e `'` do ID (sintaxe de `q` do Drive). */
export function childrenQuery(folderId: string): string {
  return `'${folderId.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' in parents and trashed = false`;
}

function toItem(file: drive_v3.Schema$File): DriveItem {
  return {
    id: file.id ?? "",
    name: file.name ?? "(sem nome)",
    mimeType: file.mimeType ?? "",
    modifiedTime: file.modifiedTime ?? null,
    version: file.version ?? null,
    size: file.size != null ? Number(file.size) : null,
    md5Checksum: file.md5Checksum ?? null,
    parents: file.parents ?? [],
    webViewLink: file.webViewLink ?? null,
    trashed: file.trashed ?? false,
    canDownload: file.capabilities?.canDownload ?? file.mimeType !== MIME.folder,
  };
}

function call<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(async () => {
    try {
      return await fn();
    } catch (error) {
      throw toDriveError(error);
    }
  });
}

interface GaxiosLikeError {
  name?: string;
  status?: number;
  code?: string | number;
  message?: string;
  response?: { status?: number; data?: unknown };
}

/**
 * O corpo do erro chega como objeto, texto (export com `responseType: "text"`) ou
 * bytes (download com `arraybuffer`) — normaliza para objeto quando for JSON.
 */
function errorBody(data: unknown): { parsed: unknown; text: string } {
  let text = "";
  if (typeof data === "string") text = data;
  else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const view = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    text = new TextDecoder().decode(view);
  } else if (data && typeof data === "object") return { parsed: data, text: JSON.stringify(data) };
  try {
    return { parsed: JSON.parse(text), text };
  } catch {
    return { parsed: undefined, text };
  }
}

function errorReason(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("error" in data)) return undefined;
  const inner = (data as { error?: unknown }).error;
  if (!inner || typeof inner !== "object") return undefined;
  return (inner as { errors?: Array<{ reason?: string }> }).errors?.[0]?.reason;
}

/** Traduz erros da API em `DriveError` com mensagem segura ([GUIA §11]). */
export function toDriveError(error: unknown): DriveError {
  if (error instanceof DriveError) return error;
  const e = (error ?? {}) as GaxiosLikeError;
  const status = e.response?.status ?? e.status ?? (typeof e.code === "number" ? e.code : undefined);
  const { parsed, text: dataText } = errorBody(e.response?.data);
  const reason = errorReason(parsed);
  const message = e.message ?? "";

  if (message.includes("invalid_grant") || dataText.includes("invalid_grant") || status === 401) {
    return new DriveError("auth", "Autorização do Google expirada ou revogada. Reconecte a conta.", { cause: error });
  }
  if (status === 429 || (reason !== undefined && QUOTA_REASONS.has(reason))) {
    return new DriveError("rate_limited", "Limite de uso da API do Google atingido; nova tentativa em seguida.", { cause: error });
  }
  if (reason === "exportSizeLimitExceeded") {
    return new DriveError("too_large", "Documento acima do limite de exportação de 10 MB do Google.", { cause: error });
  }
  if (reason === "fileNotDownloadable") {
    return new DriveError("not_downloadable", "Este tipo de arquivo não pode ser baixado diretamente.", { cause: error });
  }
  if (status === 404) return new DriveError("not_found", "Arquivo não encontrado ou sem acesso.", { cause: error });
  if (status === 403) return new DriveError("forbidden", "Sem permissão para ler este item.", { cause: error });
  if ((status !== undefined && status >= 500) || isNetworkError(e)) {
    return new DriveError("transient", "Falha temporária ao falar com o Google Drive.", { cause: error });
  }
  return new DriveError("unknown", "Erro inesperado ao ler o Google Drive.", { cause: error });
}

const NETWORK_CODES = new Set(["ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]);
/** Tempo esgotado (`timeout` do cliente) chega como AbortError/TimeoutError, sem `code`. */
const TIMEOUT_NAMES = new Set(["AbortError", "TimeoutError"]);

function isNetworkError(e: GaxiosLikeError, depth = 0): boolean {
  if (typeof e.code === "string" && NETWORK_CODES.has(e.code)) return true;
  if (typeof e.name === "string" && TIMEOUT_NAMES.has(e.name)) return true;
  const cause = (e as { cause?: unknown }).cause;
  return depth < 3 && typeof cause === "object" && cause !== null && isNetworkError(cause as GaxiosLikeError, depth + 1);
}
