import { isValidIsoDate, type Clock } from "@/lib/datetime";
import type { RegistryResolution } from "@/server/authority/registry-locator";
import type { Db } from "@/server/db/client";
import { getContent, listTrackedSources } from "@/server/db/repos/sources-repo";
import type { CellValue, SheetRow } from "@/server/extract/types";
import { matchMemberByName, type Member } from "@/server/persona/members";
import { mapHeaders, parseStatus, type RegistryField } from "./field-maps";

export const IMPORT_ACTOR = "system:import";
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

export interface ImportIssue {
  row: number;
  id: string | null;
  message: string;
}

export type ImportResult =
  | { status: "imported"; imported: number; issues: ImportIssue[] }
  | { status: "already_imported" }
  | { status: "refused"; reason: string; issues?: ImportIssue[] };

/** Índice (0-based) → letras de coluna, só para o localizador `Atividades!A2:J2`. */
function columnLetters(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function parseDueDate(cell: CellValue | undefined): { date: string | null; problem?: string } {
  const text = cell?.text.trim() ?? "";
  if (!text || /^a definir$/i.test(text)) return { date: null };
  if (cell?.date) return { date: cell.date };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && isValidIsoDate(text)) return { date: text };
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (br) {
    const iso = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    if (isValidIsoDate(iso)) return { date: iso };
  }
  return { date: null, problem: `prazo "${text.slice(0, 40)}" não reconhecido como data` };
}

const textOf = (row: SheetRow, header: string | undefined) =>
  header ? row.cells[header]?.text.trim() || null : null;

/**
 * Primeira importação do registro vigente (ARCHITECTURE §6.4), numa transação: cada
 * linha vira uma atividade oficial de partida, com ID preservado, responsáveis por nome
 * ou apelido (nome desconhecido = "a confirmar", nenhum membro é criado), evento
 * `imported` e referências à origem. Depois disso o registro não reescreve nada: só
 * ação humana muda o oficial (F4.7). Idempotente.
 */
export function importInitialRegistry(
  db: Db,
  resolution: RegistryResolution,
  members: readonly Member[],
  clock: Clock,
): ImportResult {
  if (resolution.status !== "ok") return { status: "refused", reason: resolution.reason };
  if (db.get("SELECT 1 AS present FROM registry_imports WHERE kind = 'initial'")) return { status: "already_imported" };

  const { source, sheet } = resolution;
  const map = mapHeaders(sheet.header);
  if (!map.id || !map.title) {
    return {
      status: "refused",
      reason: `A aba "${sheet.name}" não tem as colunas de ID e de atividade (título).`,
    };
  }
  const stored = getContent(db, source.file_id);
  if (!stored) return { status: "refused", reason: `"${source.name}" ainda não foi lido.` };

  const now = clock.now().toISOString();
  const trackedNames = new Map(listTrackedSources(db).map((s) => [s.name, s]));
  const lastColumn = columnLetters(Math.max(sheet.header.length - 1, 0));
  const issues: ImportIssue[] = [];
  const snapshot: Array<{ id: string; row: number; values: Partial<Record<RegistryField, string>> }> = [];
  const seen = new Set<string>();
  let imported = 0;

  db.tx(() => {
    for (const row of sheet.rows) {
      if (Object.values(row.cells).every((c) => c.text.trim() === "")) continue;
      const id = textOf(row, map.id);
      const title = textOf(row, map.title);
      if (!id || !ID_PATTERN.test(id)) {
        issues.push({ row: row.rowNumber, id, message: "linha sem ID válido; não importada" });
        continue;
      }
      // IDs comparados sem diferenciar maiúsculas: `lia-001` e `LIA-001` são a mesma atividade.
      if (seen.has(id.toUpperCase())) {
        issues.push({ row: row.rowNumber, id, message: "ID repetido no registro; só a primeira linha foi importada" });
        continue;
      }
      if (!title) {
        issues.push({ row: row.rowNumber, id, message: "linha sem título; não importada" });
        continue;
      }
      seen.add(id.toUpperCase());
      if (db.get("SELECT 1 AS present FROM activities WHERE id = ? COLLATE NOCASE", id)) {
        issues.push({ row: row.rowNumber, id, message: "já existe uma atividade com este ID (por exemplo, criada pela interface antes da importação); esta linha não foi importada" });
        continue;
      }

      const statusText = textOf(row, map.status);
      const status = statusText ? parseStatus(statusText) : null;
      if (statusText && status === null) {
        issues.push({
          row: row.rowNumber,
          id,
          message: `estado "${statusText.slice(0, 40)}" desconhecido; ficou "a confirmar"`,
        });
      }
      const due = parseDueDate(map.due_date ? row.cells[map.due_date] : undefined);
      if (due.problem) issues.push({ row: row.rowNumber, id, message: `${due.problem}; ficou "a definir"` });

      const values = {
        title,
        next_step: textOf(row, map.next_step),
        front: textOf(row, map.front),
        priority: textOf(row, map.priority),
        notes: textOf(row, map.notes),
      };
      db.run(
        `INSERT INTO activities (id, title, next_step, front, status, due_date, priority, notes, origin,
           created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'importada', ?, ?, ?, ?)`,
        id,
        values.title,
        values.next_step,
        values.front,
        status,
        due.date,
        values.priority,
        values.notes,
        now,
        IMPORT_ACTOR,
        now,
        IMPORT_ACTOR,
      );

      const owners = new Map<string, { memberId: string | null; raw: string }>();
      for (const raw of (textOf(row, map.owners) ?? "")
        .split(/[;,]/)
        .map((n) => n.trim())
        .filter(Boolean)) {
        const member = matchMemberByName(members, raw);
        owners.set(member ? member.id : `raw:${raw.toLowerCase()}`, { memberId: member?.id ?? null, raw });
      }
      for (const owner of owners.values()) {
        db.run(
          "INSERT INTO activity_owners (activity_id, member_id, raw_name) VALUES (?, ?, ?)",
          id,
          owner.memberId,
          owner.raw,
        );
      }

      db.run(
        `INSERT INTO activity_references (activity_id, file_id, source_version, locator, quote_or_cell, relation, created_at)
         VALUES (?, ?, ?, ?, ?, 'imported_from', ?)`,
        id,
        source.file_id,
        source.drive_version ?? "",
        `${sheet.name}!A${row.rowNumber}:${lastColumn}${row.rowNumber}`,
        id,
        now,
      );
      const origin = textOf(row, map.origin);
      const originFile = origin ? trackedNames.get(origin) : undefined;
      if (origin && originFile) {
        db.run(
          `INSERT INTO activity_references (activity_id, file_id, source_version, locator, quote_or_cell, relation, created_at)
           VALUES (?, ?, ?, ?, ?, 'historical_origin', ?)`,
          id,
          originFile.file_id,
          originFile.drive_version ?? "",
          `${sheet.name}!${columnLetters(sheet.header.indexOf(map.origin!))}${row.rowNumber}`,
          origin,
          now,
        );
      }

      const changes = [
        ...Object.entries({ ...values, status, due_date: due.date }).map(([field, after]) => ({
          field,
          before: null,
          after,
        })),
        { field: "owners", before: null, after: [...owners.values()].map((o) => o.memberId ?? `(a confirmar) ${o.raw}`) },
      ].filter((c) => c.after !== null && !(Array.isArray(c.after) && c.after.length === 0));
      db.run(
        `INSERT INTO activity_events (activity_id, actor_id, occurred_at, kind, changes_json, reason, source_file_id, source_version)
         VALUES (?, ?, ?, 'imported', ?, ?, ?, ?)`,
        id,
        IMPORT_ACTOR,
        now,
        JSON.stringify(changes),
        "Importação inicial do registro vigente",
        source.file_id,
        source.drive_version ?? "",
      );

      const snap: Partial<Record<RegistryField, string>> = {};
      for (const [field, header] of Object.entries(map) as Array<[RegistryField, string]>) {
        const text = textOf(row, header);
        if (text) snap[field] = text;
      }
      snapshot.push({ id, row: row.rowNumber, values: snap });
      imported++;
    }

    // Sem nenhuma linha importável (coluna errada, tudo inválido) não se grava a marca de
    // "importação inicial": o registro continua pendente e a próxima sincronização tenta de novo.
    if (imported === 0) return;
    db.run("INSERT OR IGNORE INTO id_sequences (prefix, next_value) VALUES ('LIA', 1)");
    db.run(
      `INSERT INTO registry_imports (file_id, sheet, content_hash, kind, imported_at, rows_count, issues_json, snapshot_json)
       VALUES (?, ?, ?, 'initial', ?, ?, ?, ?)`,
      source.file_id,
      sheet.name,
      stored.hash,
      now,
      imported,
      JSON.stringify(issues),
      JSON.stringify(snapshot),
    );
    db.run(
      "UPDATE sources SET authority_class = 'registro_vigente', authority_reason = ? WHERE file_id = ?",
      `Apontado pelo índice "${resolution.index.name}"`,
      source.file_id,
    );
  });

  if (imported === 0) {
    return {
      status: "refused",
      reason: `Nenhuma linha da aba "${sheet.name}" pôde ser importada (${issues.length} com problema).`,
      issues,
    };
  }
  return { status: "imported", imported, issues };
}
