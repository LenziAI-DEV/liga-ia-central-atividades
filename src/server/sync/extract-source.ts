import { DriveError } from "@/server/drive/errors";
import type { DriveGateway, DriveItem } from "@/server/drive/gateway";
import { extractMarkdown } from "@/server/extract/markdown";
import type { Extracted } from "@/server/extract/types";
import { extractXlsx } from "@/server/extract/xlsx";

/** Lê o conteúdo de um item suportado: download para `.md`/`.xlsx`, export para Google Docs ([GUIA §8]). */
export async function extractSource(
  gateway: DriveGateway,
  item: DriveItem,
  kind: "md" | "xlsx" | "gdoc",
  maxBytes: number,
): Promise<Extracted> {
  switch (kind) {
    case "md": {
      const bytes = await gateway.download(item.id, maxBytes);
      return extractMarkdown(new TextDecoder("utf-8").decode(bytes));
    }
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
