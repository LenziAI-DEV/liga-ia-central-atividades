/** Rótulos em texto para estados — nunca só cor (R11, F12.6). */

import type { SyncStatus } from "@/server/db/repos/sources-repo";
import type { RunStatus, SyncTrigger } from "@/server/db/repos/sync-runs-repo";
import type { SourceKind } from "@/server/drive/classify-file";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

// Tipados pelos unions: um estado novo sem rótulo é erro de compilação, não de execução.
export const SOURCE_STATUS: Record<SyncStatus, { label: string; tone: Tone }> = {
  processed: { label: "Processado", tone: "ok" },
  pending: { label: "Pendente", tone: "neutral" },
  failed: { label: "Falhou", tone: "danger" },
  unsupported: { label: "Não processado", tone: "warn" },
  unavailable: { label: "Indisponível", tone: "danger" },
  out_of_scope: { label: "Fora da pasta", tone: "warn" },
};

export const SOURCE_KIND: Record<SourceKind, string> = {
  md: "Markdown (.md)",
  xlsx: "Planilha (.xlsx)",
  gdoc: "Documento Google",
  folder: "Pasta",
  shortcut: "Atalho",
  unsupported: "Outro formato",
};

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  running: { label: "Em andamento", tone: "info" },
  success: { label: "Concluída", tone: "ok" },
  partial: { label: "Concluída com avisos", tone: "warn" },
  failed: { label: "Falhou", tone: "danger" },
};

export const RUN_TRIGGER: Record<SyncTrigger, string> = {
  initial: "carga inicial",
  scheduled: "automática",
  manual: "manual",
};
