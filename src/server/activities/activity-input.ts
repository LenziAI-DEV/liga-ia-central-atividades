import { isValidIsoDate } from "@/lib/datetime";
import type { Member } from "@/server/persona/members";
import type { ActivityStatus } from "./field-maps";

export const STATUS_VALUES: readonly ActivityStatus[] = ["a_fazer", "em_andamento", "bloqueada", "concluida"];

/** Campos que uma pessoa pode informar ao criar ou editar (F6.2, F6.3). */
export interface ActivityFields {
  title: string;
  description: string | null;
  nextStep: string | null;
  front: string | null;
  /** null = estado a confirmar (valor da planilha não reconhecido); só uma pessoa o define. */
  status: ActivityStatus | null;
  dueDate: string | null;
  priority: string | null;
  notes: string | null;
  /** IDs de membros. Responsáveis "a confirmar" (nome sem correspondência) não entram aqui. */
  ownerIds: string[];
}

export type FieldName = keyof ActivityFields;
export type FieldErrors = Partial<Record<FieldName, string>>;

export type ParsedInput<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const LIMITS = { title: 200, description: 4000, nextStep: 1000, front: 80, priority: 40, notes: 2000 } as const;

function text(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value === "" ? null : value;
}

/**
 * Lê o formulário (texto cru) e devolve os campos válidos ou um erro em texto por campo
 * (F6.9). Vazio vira `null`; o prazo é data de calendário sem hora (DN-13).
 */
export function parseActivityForm(
  raw: Record<string, unknown>,
  members: readonly Member[],
  ownerIds: unknown[],
  /** Valores atuais (edição): um campo importado acima do limite continua editável se não for alterado. */
  current?: Partial<Record<keyof typeof LIMITS, string | null>>,
): ParsedInput<ActivityFields> {
  const errors: FieldErrors = {};
  const tooLong = (field: keyof typeof LIMITS, label: string, value: string | null) => {
    if (value !== null && value.length > LIMITS[field] && current?.[field] !== value) {
      errors[field] = `${label} pode ter no máximo ${LIMITS[field]} caracteres.`;
    }
  };

  const title = text(raw.title);
  if (title === null) errors.title = "Informe o título da atividade.";
  tooLong("title", "O título", title);
  const description = text(raw.description);
  tooLong("description", "A descrição", description);
  const nextStep = text(raw.nextStep);
  tooLong("nextStep", "O próximo passo", nextStep);
  const front = text(raw.front);
  tooLong("front", "A frente", front);
  const priority = text(raw.priority);
  tooLong("priority", "A prioridade", priority);
  const notes = text(raw.notes);
  tooLong("notes", "As notas", notes);

  // Campo ausente = "a fazer" (criação). Campo presente e vazio = "a confirmar" (só existe ao editar
  // uma atividade que já estava assim), para que salvar outro campo não decida o estado por ninguém.
  const statusText = raw.status === undefined ? "a_fazer" : text(raw.status);
  const status = statusText === null ? null : (STATUS_VALUES.find((s) => s === statusText) ?? undefined);
  if (status === undefined) errors.status = "Escolha um estado da lista.";

  const dueText = text(raw.dueDate);
  if (dueText !== null && !(/^\d{4}-\d{2}-\d{2}$/.test(dueText) && isValidIsoDate(dueText))) {
    errors.dueDate = "Use uma data válida no formato AAAA-MM-DD, ou deixe em branco para “a definir”.";
  }

  const known = new Set(members.map((m) => m.id));
  const ids = [...new Set(ownerIds.filter((v): v is string => typeof v === "string"))];
  if (ids.some((id) => !known.has(id))) errors.ownerIds = "Escolha responsáveis da lista.";

  if (Object.keys(errors).length > 0 || title === null || status === undefined) return { ok: false, errors };
  return {
    ok: true,
    value: { title, description, nextStep, front, status, dueDate: dueText, priority, notes, ownerIds: ids },
  };
}
