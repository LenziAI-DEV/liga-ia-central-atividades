import { formatDateBR } from "@/lib/datetime";
import { ACTIVITY_STATUS } from "@/lib/labels";

/** Rótulos dos campos que uma sugestão pode propor (chaves do banco). */
export const SUGGESTION_FIELD_LABEL: Record<string, string> = {
  title: "Título",
  owners: "Responsáveis",
  due_date: "Prazo",
  next_step: "Próximo passo",
  front: "Frente",
  status: "Estado",
  description: "Descrição",
};

/** Valor de um campo em texto para a tela ("(vazio)" quando não há). */
export function formatFieldValue(field: string, value: unknown, memberNames: ReadonlyMap<string, string>): string {
  if (value === null || value === undefined || value === "") return "(vazio)";
  if (field === "status" && typeof value === "string") {
    return ACTIVITY_STATUS[value as keyof typeof ACTIVITY_STATUS]?.label ?? value;
  }
  if (field === "due_date" && typeof value === "string") return formatDateBR(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "(nenhum)" : value.map((v) => memberNames.get(String(v)) ?? String(v)).join("; ");
  }
  return String(value);
}

/**
 * Trecho de evidência para exibir: sem as marcas de Markdown (`*`, crase, `_ênfase_`). Sublinhados dentro
 * de nomes de arquivo ("Ata_registro.xlsx") ficam, porque não são ênfase. A conferência usa o texto literal.
 */
export function displayQuote(quote: string): string {
  return quote
    .replace(/[*`]/g, "")
    .replace(/(^|\s)_+(\S(?:[^_]*\S)?)_+(?=\s|[.,;:!?]|$)/g, "$1$2");
}
