import { DriveError } from "@/server/drive/errors";
import type { DriveGateway, DriveItem } from "@/server/drive/gateway";
import { extractMarkdown } from "@/server/extract/markdown";
import type { Extracted } from "@/server/extract/types";
import { extractXlsx } from "@/server/extract/xlsx";

/**
 * Texto de arquivo `.md`: UTF-8 estrito; se não for UTF-8 válido, Windows-1252
 * (comum em arquivos salvos no Windows). Nunca troca bytes por U+FFFD em silêncio —
 * isso quebraria a conferência de evidência literal.
 */
export function decodeText(bytes: Uint8Array): string {
  // UTF-16 com BOM ("Unicode" no Bloco de Notas do Windows).
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Lê o conteúdo de um item suportado: download para `.md`/`.xlsx`, export para Google Docs ([GUIA §8]). */
export async function extractSource(
  gateway: DriveGateway,
  item: DriveItem,
  kind: "md" | "xlsx" | "gdoc",
  maxBytes: number,
): Promise<Extracted> {
  switch (kind) {
    case "md":
      return extractMarkdown(decodeText(await gateway.download(item.id, maxBytes)));
    case "xlsx":
      return extractXlsx(await gateway.download(item.id, maxBytes));
    case "gdoc": {
      let text: string;
      try {
        text = await gateway.exportDoc(item.id, "text/markdown");
      } catch (error) {
        const fatal = error instanceof DriveError && ["auth", "too_large", "not_found", "forbidden"].includes(error.kind);
        if (fatal || !(error instanceof DriveError)) throw error;
        text = await gateway.exportDoc(item.id, "text/plain");
      }
      return extractMarkdown(text);
    }
  }
}
