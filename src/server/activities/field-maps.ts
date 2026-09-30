import { nameKey } from "@/server/persona/members";

export type RegistryField =
  | "id"
  | "title"
  | "owners"
  | "due_date"
  | "front"
  | "priority"
  | "status"
  | "next_step"
  | "origin"
  | "notes";

export type ActivityStatus = "a_fazer" | "em_andamento" | "bloqueada" | "concluida";

/** Sinônimos de cabeçalho (comparados sem acento, sem caixa e sem espaços extras). */
const HEADER_SYNONYMS: Record<RegistryField, string[]> = {
  id: ["id", "codigo", "identificador", "cod"],
  title: ["atividade", "titulo", "tarefa"],
  owners: ["responsaveis", "responsavel", "dono", "donos", "owner", "owners"],
  due_date: ["prazo", "data limite", "vencimento", "deadline"],
  front: ["frente", "area", "equipe"],
  priority: ["prioridade", "prior"],
  status: ["status", "estado", "situacao"],
  next_step: ["proximo passo", "proxima acao", "proximos passos"],
  origin: ["origem"],
  notes: ["notas e bloqueios", "notas", "observacoes", "bloqueios", "obs"],
};

const STATUS_VOCABULARY: Record<string, ActivityStatus> = {
  "a fazer": "a_fazer",
  pendente: "a_fazer",
  "nao iniciada": "a_fazer",
  "em andamento": "em_andamento",
  andamento: "em_andamento",
  "em progresso": "em_andamento",
  bloqueada: "bloqueada",
  bloqueado: "bloqueada",
  concluida: "concluida",
  concluido: "concluida",
  finalizada: "concluida",
  feita: "concluida",
};

/** Campo → texto exato do cabeçalho na planilha. A primeira coluna que casar vence. */
export function mapHeaders(header: readonly string[]): Partial<Record<RegistryField, string>> {
  const map: Partial<Record<RegistryField, string>> = {};
  for (const label of header) {
    // Sem pontuação: "Prior." e "Prior" são o mesmo cabeçalho.
    const key = nameKey(label).replace(/[^a-z0-9 ]/g, "").trim();
    for (const field of Object.keys(HEADER_SYNONYMS) as RegistryField[]) {
      if (map[field] === undefined && HEADER_SYNONYMS[field].includes(key)) map[field] = label;
    }
  }
  return map;
}

export function parseStatus(text: string): ActivityStatus | null {
  return STATUS_VOCABULARY[nameKey(text)] ?? null;
}
