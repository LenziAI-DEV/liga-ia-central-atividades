/** Rótulos em texto para estados — nunca só cor (R11, F12.6). */

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

export const SOURCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  processed: { label: "Processado", tone: "ok" },
  pending: { label: "Pendente", tone: "neutral" },
  failed: { label: "Falhou", tone: "danger" },
  unsupported: { label: "Não processado", tone: "warn" },
  unavailable: { label: "Indisponível", tone: "danger" },
  out_of_scope: { label: "Fora da pasta", tone: "warn" },
};

export const SOURCE_KIND: Record<string, string> = {
  md: "Markdown (.md)",
  xlsx: "Planilha (.xlsx)",
  gdoc: "Documento Google",
  folder: "Pasta",
  shortcut: "Atalho",
  unsupported: "Outro formato",
};

export const RUN_STATUS: Record<string, { label: string; tone: Tone }> = {
  running: { label: "Em andamento", tone: "info" },
  success: { label: "Concluída", tone: "ok" },
  partial: { label: "Concluída com avisos", tone: "warn" },
  failed: { label: "Falhou", tone: "danger" },
};

export const RUN_TRIGGER: Record<string, string> = {
  initial: "carga inicial",
  scheduled: "automática",
  manual: "manual",
};
