import { MIME, type DriveItem } from "./gateway";

export type SourceKind = "md" | "xlsx" | "gdoc" | "folder" | "shortcut" | "unsupported";

export interface Classification {
  kind: SourceKind;
  /** Motivo em texto quando o item não é processado (CA-F2.2, DN-09). */
  reason?: string;
}

const GENERIC_MIMES = new Set(["application/octet-stream", "text/plain", "text/x-markdown", ""]);

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Decide como ler um item, pelo tipo MIME **e** pela extensão — um `.md` enviado ao
 * Drive costuma chegar como `text/plain` ou `application/octet-stream` (RT-I).
 */
export function classifyFile(item: Pick<DriveItem, "name" | "mimeType">): Classification {
  const { mimeType } = item;
  const ext = extension(item.name);

  if (mimeType === MIME.folder) return { kind: "folder" };
  if (mimeType === MIME.shortcut) {
    return { kind: "shortcut", reason: "Atalho não é seguido: o destino pode estar fora da pasta monitorada." };
  }
  if (mimeType === MIME.gdoc) return { kind: "gdoc" };
  if (mimeType === MIME.xlsx || (ext === "xlsx" && GENERIC_MIMES.has(mimeType))) return { kind: "xlsx" };
  if (mimeType === MIME.markdown || mimeType === "text/x-markdown" || (ext === "md" && GENERIC_MIMES.has(mimeType))) {
    return { kind: "md" };
  }

  return { kind: "unsupported", reason: unsupportedReason(mimeType, ext) };
}

function unsupportedReason(mimeType: string, ext: string): string {
  if (mimeType === MIME.gsheet) {
    return "Formato ainda não processado: Planilha Google nativa. Envie o arquivo como .xlsx (com “Converter uploads” desmarcado).";
  }
  if (mimeType === MIME.docx || ext === "docx") {
    return "Formato ainda não processado: .docx. Converta para Documento Google no Drive (Abrir com › Documentos Google).";
  }
  if (mimeType === MIME.pdf || ext === "pdf") return "Formato ainda não processado: PDF.";
  if (mimeType.startsWith("image/")) return "Formato ainda não processado: imagem (fora do escopo; OCR não é feito).";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return "Formato ainda não processado: áudio/vídeo (fora do escopo).";
  }
  return `Formato ainda não processado: ${ext ? `.${ext}` : mimeType || "tipo desconhecido"}.`;
}
