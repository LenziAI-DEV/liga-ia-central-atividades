import { createHash } from "node:crypto";
import { isValidIsoDate } from "@/lib/datetime";
import type { ActivityStatus } from "@/server/activities/field-maps";
import type { Section } from "@/server/extract/types";
import { matchMemberByName, nameKey, type Member } from "@/server/persona/members";
import type { ExtractionItem, ExtractionOutput } from "./schema";

export interface ValidatorActivity {
  id: string;
  title: string;
  ownerIds: string[];
  dueDate: string | null;
  status: ActivityStatus | null;
  nextStep: string | null;
  front: string | null;
}

export interface ValidationContext {
  /** Texto normalizado da versão processada: é contra ele que a evidência é conferida. */
  documentText: string;
  sections: Section[];
  members: readonly Member[];
  /** Frentes conhecidas (membros e atividades). */
  fronts: readonly string[];
  activities: readonly ValidatorActivity[];
}

export interface ProposedFields {
  title?: string;
  ownerIds?: string[];
  dueDate?: string;
  nextStep?: string;
  front?: string;
  status?: ActivityStatus;
}

export interface ValidSuggestion {
  kind: "create" | "update";
  targetActivityId: string | null;
  fields: ProposedFields;
  /** Campos propostos que a IA inferiu e o texto não afirma (ex.: frente). */
  uncertainFields: Array<keyof ProposedFields>;
  evidence: string;
  locator: string;
  rationale: string;
  uncertainties: string[];
  dedupeKey: string;
}

export interface NoActionItem {
  reason: string;
  rationale: string;
  evidence: string;
  /** Atividade que o texto apenas confirma (vira referência `historical_origin`). */
  relatedActivityId: string | null;
}

export interface InvalidItem {
  reason: string;
  kind: string;
  evidence: string;
}

export interface ValidationResult {
  summary: string;
  suggestions: ValidSuggestion[];
  noAction: NoActionItem[];
  invalid: InvalidItem[];
}

/** Marcadores de hipótese (regra 8). Configurável: só esta lista precisa mudar. */
export const HYPOTHESIS_MARKERS = [
  "talvez",
  "quem sabe",
  "poderiamos",
  "poderia ser",
  "seria interessante",
  "ideia",
  "ninguem assumiu",
  "sem dono",
];

/** Frases dirigidas a uma IA dentro do documento (defesa em profundidade contra injeção, F7.7, V-12). */
export const INJECTION_MARKERS = ["ignore as regras", "ignore todas as", "ignore as instrucoes", "ignore previous", "desconsidere as regras", "voce agora e", "you are now", "marque todas as tarefas", "apague as demais", "apague todas"];

const STOPWORDS = new Set(["para", "sobre", "com", "uma", "dos", "das", "que", "por", "como", "atividade", "tarefa", "este", "esta", "essa", "esse", "mais", "pela", "pelo", "seus", "suas"]);

const MONTHS: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

/** NFC, aspas retas, sem marcas de Markdown (`*`, `_`, crase), espaços colapsados, sem caixa. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const plain = (text: string) => nameKey(normalizeForMatch(text));

function tokens(text: string): Set<string> {
  return new Set(
    plain(text)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/** Datas inequívocas no trecho: ISO, dd/mm/aaaa e "d de mês de aaaa". */
function datesIn(text: string): Set<string> {
  const found = new Set<string>();
  const t = plain(text);
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) found.add(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) found.add(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  for (const m of t.matchAll(/\b(\d{1,2}) de ([a-z]+) de (\d{4})\b/g)) {
    const month = MONTHS[m[2]];
    if (month) found.add(`${m[3]}-${month}-${m[1].padStart(2, "0")}`);
  }
  return found;
}

/** "Seção X, linha N" do início da evidência, calculado pelo servidor (nunca pelo modelo). */
function locate(evidence: string, ctx: ValidationContext): string {
  const needle = normalizeForMatch(evidence).slice(0, 40);
  const lines = ctx.documentText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const window = normalizeForMatch(`${lines[i]} ${lines[i + 1] ?? ""}`);
    if (needle && window.includes(needle)) {
      const line = i + 1;
      const section = [...ctx.sections].reverse().find((s) => s.line <= line);
      return section ? `Seção "${section.heading}", linha ${line}` : `Linha ${line}`;
    }
  }
  return "";
}

/** Parágrafo (bloco entre linhas em branco) que contém a evidência: a citação do ID pode estar na frase vizinha. */
function enclosingBlock(evidence: string, ctx: ValidationContext): string {
  const needle = normalizeForMatch(evidence);
  const block = ctx.documentText.split(/\n[ \t]*\n/).find((b) => normalizeForMatch(b).includes(needle));
  return block ?? evidence;
}

function mentionsOwner(evidencePlain: string, member: Member): boolean {
  return [member.name, ...member.aliases].some((label) => {
    const key = plain(label);
    return key !== "" && new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(evidencePlain);
  });
}

function dedupeKey(kind: string, target: string | null, fields: ProposedFields): string {
  const entries = Object.entries(fields)
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort().join(",") : plain(String(v))] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify([kind, target, entries])).digest("hex");
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Validador determinístico e obrigatório (ADR-09, F7.6). Nada que o modelo diga chega à tela sem
 * passar por aqui: evidência literal, alvo mencionado, datas inequívocas, responsáveis conhecidos
 * e presentes no trecho, hipótese e "confirma o oficial" rebaixados, dedupe. Itens ruins são
 * guardados como inválidos, com o motivo, e nunca viram proposta.
 */
export function validateExtraction(output: ExtractionOutput, ctx: ValidationContext): ValidationResult {
  const docNorm = normalizeForMatch(ctx.documentText);
  const knownFronts = new Map(ctx.fronts.map((f) => [plain(f), f]));
  const byId = new Map(ctx.activities.map((a) => [a.id.toLowerCase(), a]));
  const result: ValidationResult = { summary: output.document_summary.trim(), suggestions: [], noAction: [], invalid: [] };

  for (const item of output.items) {
    const evidence = item.evidence.trim();
    const invalid = (reason: string) => result.invalid.push({ reason, kind: item.kind, evidence: evidence.slice(0, 300) });

    // 3. Evidência literal.
    const evidenceNorm = normalizeForMatch(evidence);
    if (evidenceNorm === "" || !docNorm.includes(evidenceNorm)) {
      invalid("o trecho de evidência não existe literalmente no documento");
      continue;
    }

    if (item.kind === "no_action") {
      result.noAction.push({
        reason: item.rationale.trim() || "sem ação",
        rationale: item.rationale.trim(),
        evidence,
        relatedActivityId: null,
      });
      continue;
    }

    const evidencePlain = plain(evidence);
    const blockPlain = plain(enclosingBlock(evidence, ctx));
    if (INJECTION_MARKERS.some((m) => blockPlain.includes(m))) {
      invalid("o trecho contém instruções dirigidas à IA; ignorado");
      continue;
    }
    const uncertainties = item.uncertainties.map((u) => u.trim()).filter(Boolean);
    const uncertainFields: Array<keyof ProposedFields> = [];
    const fields: ProposedFields = {};

    // 4. Alvo do update existe e é mencionado na evidência.
    let target: ValidatorActivity | undefined;
    if (item.kind === "update") {
      target = item.target_activity_id ? byId.get(item.target_activity_id.trim().toLowerCase()) : undefined;
      if (!target) {
        invalid("a atividade de destino não existe");
        continue;
      }
      const titleTokens = tokens(target.title);
      const scope = `${evidencePlain} ${blockPlain}`;
      const mentionsId = scope.includes(target.id.toLowerCase());
      if (!mentionsId && overlap(titleTokens, tokens(scope)) < Math.min(2, Math.max(titleTokens.size, 1))) {
        invalid("nem a evidência nem o parágrafo dela mencionam a atividade de destino");
        continue;
      }
    }

    // Título (só em create).
    if (item.kind === "create") {
      const title = item.title?.trim();
      if (!title) {
        invalid("criação sem título");
        continue;
      }
      fields.title = title;
    }

    // 6. Responsáveis.
    const ownerIds: string[] = [];
    for (const name of item.owners.map((n) => n.trim()).filter(Boolean)) {
      const member = matchMemberByName(ctx.members, name);
      if (!member) {
        uncertainties.push(`nome desconhecido: ${name}`);
      } else if (!mentionsOwner(evidencePlain, member)) {
        uncertainties.push(`responsável não explícito no trecho: ${member.name}`);
      } else if (!ownerIds.includes(member.id)) {
        ownerIds.push(member.id);
      }
    }
    if (ownerIds.length > 0) fields.ownerIds = ownerIds;

    // 5. Prazo inequívoco.
    const proposedDue = item.due_date?.trim() || null;
    if (proposedDue) {
      if (isValidIsoDate(proposedDue) && datesIn(evidence).has(proposedDue)) fields.dueDate = proposedDue;
      else uncertainties.push("prazo relativo/ambíguo — confirmar");
    } else if (item.due_date_text?.trim()) {
      uncertainties.push("prazo relativo — confirmar");
    }

    if (item.next_step?.trim()) fields.nextStep = item.next_step.trim().slice(0, 1000);
    if (item.status) fields.status = item.status;

    // 7. Frente.
    if (item.front?.trim()) {
      const known = knownFronts.get(plain(item.front));
      if (!known) {
        uncertainties.push(`frente desconhecida: ${item.front.trim()}`);
      } else {
        fields.front = known;
        if (!evidencePlain.includes(plain(known))) {
          uncertainFields.push("front");
          uncertainties.push("frente inferida — confirmar");
        }
      }
    }

    if (item.kind === "update" && target) {
      // 9. Confirma o oficial: remove campos iguais ao valor atual.
      if (fields.ownerIds && sameSet(fields.ownerIds, target.ownerIds)) delete fields.ownerIds;
      if (fields.dueDate && fields.dueDate === target.dueDate) delete fields.dueDate;
      if (fields.nextStep && target.nextStep && plain(fields.nextStep) === plain(target.nextStep)) delete fields.nextStep;
      if (fields.status && fields.status === target.status) delete fields.status;
      if (fields.front && target.front && plain(fields.front) === plain(target.front)) {
        delete fields.front;
        const at = uncertainFields.indexOf("front");
        if (at >= 0) uncertainFields.splice(at, 1);
      }
      if (Object.keys(fields).length === 0) {
        result.noAction.push({
          reason: "confirma o registro oficial",
          rationale: item.rationale.trim(),
          evidence,
          relatedActivityId: target.id,
        });
        continue;
      }
      // 6 (DN-14). Mudança de responsável nunca passa sem aviso.
      if (fields.ownerIds) uncertainties.push("mudança de responsável — confirmar");
    }

    if (item.kind === "create") {
      // 8. Hipótese sem dono e sem decisão.
      if (!fields.ownerIds && HYPOTHESIS_MARKERS.some((m) => evidencePlain.includes(m))) {
        result.noAction.push({
          reason: "hipótese sem dono nem decisão",
          rationale: item.rationale.trim(),
          evidence,
          relatedActivityId: null,
        });
        continue;
      }
      // 11. Possível relação com atividade existente (DN-17).
      const proposedTokens = tokens(`${fields.title ?? ""} ${evidence}`);
      for (const existing of ctx.activities) {
        const shared = overlap(tokens(existing.title), proposedTokens);
        const sharesOwner = (fields.ownerIds ?? []).some((id) => existing.ownerIds.includes(id));
        if (shared >= 2 || (shared >= 1 && sharesOwner)) {
          uncertainties.push(`possível relação com ${existing.id} (${existing.title})`);
        }
      }
    }

    result.suggestions.push({
      kind: item.kind,
      targetActivityId: target?.id ?? null,
      fields,
      uncertainFields,
      evidence,
      locator: locate(evidence, ctx),
      rationale: item.rationale.trim(),
      uncertainties: [...new Set(uncertainties)],
      dedupeKey: dedupeKey(item.kind, target?.id ?? null, fields),
    });
  }
  return result;
}

export type { ExtractionItem };
