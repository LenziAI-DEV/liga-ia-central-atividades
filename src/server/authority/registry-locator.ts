import type { Db } from "@/server/db/client";
import { getSetting, SETTING, type RootFolder } from "@/server/db/repos/settings-repo";
import { getContent, listTrackedSources, type SourceRow } from "@/server/db/repos/sources-repo";
import type { Sheet } from "@/server/extract/types";
import { nameKey } from "@/server/persona/members";
import { parseIndex } from "./index-parser";

export type RegistryProblem =
  | "no_root"
  | "no_index"
  | "index_ambiguous"
  | "index_unreadable"
  | "no_pointer"
  | "pointer_ambiguous"
  | "file_not_found"
  | "file_ambiguous"
  | "file_not_read"
  | "sheet_missing";

export type RegistryResolution =
  | { status: "ok"; index: SourceRow; source: SourceRow; sheet: Sheet }
  | { status: "pending"; problem: RegistryProblem; reason: string; index?: SourceRow };

/** Nome sem a extensão, sem diferenciar caixa e acentos. */
function baseName(name: string): string {
  return nameKey(name.replace(/\.[A-Za-z0-9]{1,5}$/, ""));
}

const pending = (problem: RegistryProblem, reason: string, index?: SourceRow): RegistryResolution => ({
  status: "pending",
  problem,
  reason,
  index,
});

/**
 * Localiza o registro vigente das atividades (ADR-11, F4.2/F4.5): índice na raiz →
 * arquivo e aba que ele aponta. Zero ou vários candidatos viram pendência visível
 * com o motivo, e nada é importado. Nunca escolhe "a planilha mais recente".
 */
export function resolveRegistry(db: Db, indexFileName: string): RegistryResolution {
  const root = getSetting<RootFolder>(db, SETTING.rootFolder);
  if (!root) return pending("no_root", "Nenhuma pasta conectada.");

  const tracked = listTrackedSources(db);
  const wanted = indexFileName.toLowerCase();
  const indexes = tracked.filter(
    (s) => s.parent_id === root.id && (s.kind === "md" || s.kind === "gdoc") && s.name.toLowerCase() === wanted,
  );
  if (indexes.length === 0) return pending("no_index", `O índice "${indexFileName}" não está na raiz da pasta.`);
  if (indexes.length > 1) return pending("index_ambiguous", `Há mais de um "${indexFileName}" na raiz da pasta.`);
  const index = indexes[0];

  const content = getContent(db, index.file_id)?.extracted;
  if (index.sync_status !== "processed" || content?.kind !== "text") {
    return pending("index_unreadable", `O índice "${index.name}" ainda não foi lido.`, index);
  }

  const { registry } = parseIndex(content.text);
  if (registry.length === 0) {
    return pending("no_pointer", `O índice "${index.name}" não diz qual arquivo é a fonte das atividades.`, index);
  }
  const distinct = new Map(registry.map((p) => [`${p.fileName}\u0000${p.sheetName ?? ""}`, p]));
  if (distinct.size > 1) {
    return pending("pointer_ambiguous", "O índice aponta mais de um arquivo ou aba como fonte das atividades.", index);
  }
  const pointer = registry[0];

  let files = tracked.filter((s) => s.kind === "xlsx" && s.name === pointer.fileName);
  if (files.length === 0) {
    // O arquivo apontado pode ter mudado só de extensão (ex.: .xlsx → .xlsm ao salvar pelo Planilhas Google).
    // Só vale se for uma única planilha com o mesmo nome-base; mais de uma, ou nenhuma, segue como pendência.
    const base = baseName(pointer.fileName);
    const sameBase = tracked.filter((s) => s.kind === "xlsx" && baseName(s.name) === base);
    if (sameBase.length === 1) files = sameBase;
  }
  if (files.length === 0) {
    return pending("file_not_found", `O arquivo "${pointer.fileName}" citado no índice não está na pasta.`, index);
  }
  if (files.length > 1) {
    return pending("file_ambiguous", `Há mais de um arquivo chamado "${pointer.fileName}" na pasta.`, index);
  }
  const source = files[0];

  const sheets = getContent(db, source.file_id)?.extracted;
  if (source.sync_status !== "processed" || sheets?.kind !== "sheet") {
    return pending("file_not_read", `"${source.name}" ainda não foi lido.`, index);
  }
  let sheet: Sheet | undefined;
  if (pointer.sheetName === null) {
    if (sheets.sheets.length === 1) sheet = sheets.sheets[0];
  } else {
    const key = nameKey(pointer.sheetName);
    sheet = sheets.sheets.find((s) => s.name === pointer.sheetName) ?? sheets.sheets.find((s) => nameKey(s.name) === key);
  }
  if (!sheet) {
    const label = pointer.sheetName ? `a aba "${pointer.sheetName}"` : "a aba das atividades";
    return pending("sheet_missing", `Não encontrei ${label} em "${source.name}".`, index);
  }
  return { status: "ok", index, source, sheet };
}
