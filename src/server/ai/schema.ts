import { z } from "zod";

/**
 * Contrato da saída do modelo (ARCHITECTURE §6.5). `source_file_id` e `source_version` NÃO fazem
 * parte: o servidor os injeta, o modelo nunca os informa. Campos opcionais são `null` (não ausentes),
 * o que o Structured Outputs exige.
 */
export const ItemSchema = z.object({
  kind: z.enum(["create", "update", "no_action"]),
  target_activity_id: z.string().nullable(),
  title: z.string().nullable(),
  /** Nomes como aparecem no texto. */
  owners: z.array(z.string()),
  /** AAAA-MM-DD; só quando o texto traz a data de forma inequívoca. */
  due_date: z.string().nullable(),
  /** Expressão literal do prazo no texto ("2026-10-07", "até sexta"). */
  due_date_text: z.string().nullable(),
  next_step: z.string().nullable(),
  front: z.string().nullable(),
  status: z.enum(["a_fazer", "em_andamento", "bloqueada", "concluida"]).nullable(),
  /** Trecho literal do documento que sustenta o item. */
  evidence: z.string(),
  rationale: z.string(),
  uncertainties: z.array(z.string()),
});

export const ExtractionSchema = z.object({
  /** "Resumo do que mudou" no documento (F7.1). */
  document_summary: z.string(),
  items: z.array(ItemSchema),
});

export type ExtractionItem = z.infer<typeof ItemSchema>;
export type ExtractionOutput = z.infer<typeof ExtractionSchema>;
