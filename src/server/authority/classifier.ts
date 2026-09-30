import { mapHeaders } from "@/server/activities/field-maps";
import type { Db } from "@/server/db/client";
import { getSetting, SETTING, type RootFolder } from "@/server/db/repos/settings-repo";
import { getContent, listTrackedSources, type SourceRow } from "@/server/db/repos/sources-repo";
import type { Extracted } from "@/server/extract/types";
import { nameKey } from "@/server/persona/members";
import { parseIndex, type IndexPointers } from "./index-parser";
import { resolveRegistry, type RegistryResolution } from "./registry-locator";

export type AuthorityClass = "direcao_ativo" | "direcao_parcial" | "registro_vigente" | "ata" | "historico" | "sem_autoridade";

export interface Classification {
  class: AuthorityClass;
  /** Motivos calculados, em texto, para a pessoa decidir (R10). */
  reasons: string[];
  /** Planilha parecida com o registro, sem ser o registro vigente (CA-F4.1). */
  possibleConflict: boolean;
  /** Para documentos superados: quem os substituiu, quando o documento diz. */
  supersededBy: string | null;
}

export const AUTHORITY_LABEL: Record<AuthorityClass, string> = {
  direcao_ativo: "direção — ativo",
  direcao_parcial: "direção — parcial",
  registro_vigente: "registro de atividades vigente",
  ata: "ata",
  historico: "histórico/superado",
  sem_autoridade: "sem autoridade definida",
};

/** O nome precisa aparecer inteiro ("guia.md" não casa dentro de "novo_guia.md"). */
function mentionsName(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);
  return new RegExp(`(?<![\\w.-])${escaped}(?![\\w-])`).test(text);
}

const SUPERSEDED_STATUS = new Set(["deprecated", "superado", "superada", "obsoleto", "obsoleta", "historico"]);

const tokens = (name: string) =>
  nameKey(name.replace(/\.[A-Za-z0-9]{1,5}$/, ""))
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^[0-9]+$/.test(t));

function textMeta(extracted: Extracted | undefined): Record<string, string> {
  return extracted?.kind === "text" ? extracted.metadata : {};
}

function countFilledRows(sheet: { rows: Array<{ cells: Record<string, { text: string }> }> }): number {
  return sheet.rows.filter((r) => Object.values(r.cells).some((c) => c.text.trim() !== "")).length;
}

/** Planilha com cara de registro de atividades (colunas de ID e de atividade). */
function looksLikeRegistry(extracted: Extracted | undefined): boolean {
  if (extracted?.kind !== "sheet") return false;
  return extracted.sheets.some((s) => {
    const map = mapHeaders(s.header);
    return Boolean(map.id && map.title);
  });
}

/**
 * Classifica cada fonte acompanhada, de forma determinística (ADR-11, F4.8), a partir do
 * índice e dos metadados declarados no próprio documento. Na dúvida: "sem autoridade
 * definida", que nunca altera atividades. A ordem das regras:
 * 1. é o registro apontado pelo índice → registro vigente;
 * 2. é o índice → direção;
 * 3. `status` de superado, ou outro documento diz que o substitui, ou o índice o declara
 *    superado → histórico;
 * 4. tem data de reunião → ata (antes de "direção": as atas também são citadas no índice);
 * 5. citado no índice com `status` ativo/parcial → direção;
 * 6. o resto → sem autoridade, com os motivos (e "possível conflito" se parece o registro).
 */
export function classifySources(db: Db, indexFileName: string): Map<string, Classification> {
  // O conteúdo extraído é lido do banco no máximo uma vez por fonte nesta chamada.
  const cache = new Map<string, Extracted | undefined>();
  const contentOf = (fileId: string) => {
    if (!cache.has(fileId)) cache.set(fileId, getContent(db, fileId)?.extracted);
    return cache.get(fileId);
  };
  const result = new Map<string, Classification>();
  const root = getSetting<RootFolder>(db, SETTING.rootFolder);
  const tracked = listTrackedSources(db).filter((s) => s.kind !== "folder");
  const resolution: RegistryResolution = resolveRegistry(db, indexFileName);
  const indexSource = resolution.index;
  const wanted = indexFileName.toLowerCase();
  const indexRow =
    indexSource ??
    tracked.find((s) => s.parent_id === root?.id && (s.kind === "md" || s.kind === "gdoc") && s.name.toLowerCase() === wanted);

  let pointers: IndexPointers = { registry: [], superseded: [], cited: [] };
  if (indexRow) {
    const content = contentOf(indexRow.file_id);
    if (content?.kind === "text") pointers = parseIndex(content.text);
  }

  // Quem declara substituir quem: `substitui: X.md ...` no corpo de outro documento.
  const replacedBy = new Map<string, string>();
  for (const s of tracked) {
    const meta = textMeta(contentOf(s.file_id));
    const replaces = meta.substitui ?? "";
    for (const other of tracked) {
      if (other.file_id !== s.file_id && mentionsName(replaces, other.name)) replacedBy.set(other.file_id, s.name);
    }
  }

  const registryName = resolution.status === "ok" ? resolution.source.name : (pointers.registry[0]?.fileName ?? null);

  for (const source of tracked) {
    result.set(source.file_id, classifyOne(contentOf(source.file_id), source, { resolution, indexRow, pointers, replacedBy, registryName }));
  }
  return result;
}

function classifyOne(
  extracted: Extracted | undefined,
  source: SourceRow,
  ctx: {
    resolution: RegistryResolution;
    indexRow: SourceRow | undefined;
    pointers: IndexPointers;
    replacedBy: Map<string, string>;
    registryName: string | null;
  },
): Classification {
  const { resolution, indexRow, pointers, replacedBy, registryName } = ctx;
  const meta = textMeta(extracted);
  const status = (meta.status ?? "").toLowerCase();
  const make = (cls: AuthorityClass, reasons: string[], extra: Partial<Classification> = {}): Classification => ({
    class: cls,
    reasons,
    possibleConflict: false,
    supersededBy: null,
    ...extra,
  });

  if (resolution.status === "ok" && resolution.source.file_id === source.file_id) {
    return make("registro_vigente", [`apontado pelo índice "${resolution.index.name}" (aba "${resolution.sheet.name}")`]);
  }
  if (indexRow && indexRow.file_id === source.file_id) {
    return make(status === "parcial" ? "direcao_parcial" : "direcao_ativo", ["índice do acervo, na raiz da pasta"]);
  }

  const declared = pointers.superseded.includes(source.name);
  const byOther = replacedBy.get(source.file_id);
  if (SUPERSEDED_STATUS.has(status) || meta.substituido_por || declared || byOther) {
    const by = meta.substituido_por ?? byOther ?? null;
    const reasons = [by ? `substituído por ${by}` : "declarado superado"];
    if (SUPERSEDED_STATUS.has(status)) reasons.push(`status: ${status}`);
    if (declared) reasons.push("o índice o declara superado");
    return make("historico", reasons, { supersededBy: by });
  }

  if (meta.data_da_reuniao || source.doc_date) {
    return make("ata", [`data da reunião: ${meta.data_da_reuniao ?? source.doc_date}`]);
  }

  const cited = pointers.cited.includes(source.name);
  if (cited && (status === "ativo" || status === "parcial")) {
    return make(status === "parcial" ? "direcao_parcial" : "direcao_ativo", [`citado no índice; status: ${status}`]);
  }

  // Sem autoridade: calcula os motivos e se parece com o registro.
  const reasons: string[] = [];
  reasons.push(resolution.status === "ok" ? "não apontado pelo índice como fonte vigente" : "não há registro vigente identificado");
  if (!cited) reasons.push("não citado no índice");
  let possibleConflict = false;
  if (source.kind === "xlsx") {
    const similarName = registryName !== null && tokens(source.name).some((t) => tokens(registryName).includes(t));
    const similarHeader = looksLikeRegistry(extracted);
    possibleConflict = similarName || similarHeader;
    if (extracted?.kind === "sheet") {
      const pointerSheet = resolution.status === "ok" ? resolution.sheet.name : null;
      for (const sheet of extracted.sheets) {
        if (pointerSheet && sheet.name !== pointerSheet) reasons.push(`aba "${sheet.name}" ≠ "${pointerSheet}"`);
        const rows = countFilledRows(sheet);
        reasons.push(rows === 0 ? "0 registros" : `${rows} registro(s)`);
      }
    }
    if (similarHeader) reasons.push("cabeçalho parecido com o do registro");
    if (similarName) reasons.push("nome parecido com o do registro");
  }
  return make("sem_autoridade", reasons, { possibleConflict });
}

/** Rótulo curto exibido na interface. */
export function authorityLabel(c: Classification): string {
  return c.class === "sem_autoridade" && c.possibleConflict ? "sem autoridade / possível conflito" : AUTHORITY_LABEL[c.class];
}
