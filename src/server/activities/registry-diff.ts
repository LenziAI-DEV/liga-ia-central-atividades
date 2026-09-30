import { createHash } from "node:crypto";
import type { Clock } from "@/lib/datetime";
import { resolveRegistry } from "@/server/authority/registry-locator";
import type { Db } from "@/server/db/client";
import { getContent } from "@/server/db/repos/sources-repo";
import type { SheetRow } from "@/server/extract/types";
import { matchMemberByName, type Member } from "@/server/persona/members";
import { mapHeaders, parseStatus, type RegistryField } from "./field-maps";
import { parseDueDate, type ImportIssue } from "./registry-importer";

export type DiffResult =
  | { status: "none"; reason: string }
  | { status: "compared"; suggestions: number; warnings: ImportIssue[] };

const textOf = (row: SheetRow, header: string | undefined) => (header ? row.cells[header]?.text.trim() || null : null);
const plain = (value: unknown) => String(value ?? "").normalize("NFC").trim().toLowerCase();

interface Activity {
  id: string;
  title: string;
  front: string | null;
  status: string | null;
  due_date: string | null;
  next_step: string | null;
}

/**
 * Nova versão do registro vigente (DN-02, F4.7): compara as linhas com o valor OFICIAL atual e
 * gera sugestões (origin `registry_diff`), nunca escrita direta. Linha que sumiu vira aviso, e
 * nada é apagado (RN-11). Só roda depois da importação inicial e só para uma versão nova.
 */
export function diffRegistry(db: Db, indexFileName: string, members: readonly Member[], clock: Clock): DiffResult {
  const resolution = resolveRegistry(db, indexFileName);
  if (resolution.status !== "ok") return { status: "none", reason: resolution.reason };
  const { source, sheet } = resolution;
  const initial = db.get<{ file_id: string; content_hash: string }>("SELECT file_id, content_hash FROM registry_imports WHERE kind = 'initial'");
  const stored = getContent(db, source.file_id);
  if (!initial || !stored) return { status: "none", reason: "ainda não houve importação inicial" };
  if (initial.file_id !== source.file_id) return { status: "none", reason: "o índice aponta outra fonte; requer decisão" };
  if (db.get("SELECT 1 AS present FROM registry_imports WHERE file_id = ? AND content_hash = ?", source.file_id, stored.hash)) {
    return { status: "none", reason: "versão já comparada" };
  }

  const map = mapHeaders(sheet.header);
  const now = clock.now().toISOString();
  const warnings: ImportIssue[] = [];
  let suggestions = 0;
  const seenIds = new Set<string>();

  db.tx(() => {
    // Sugestões de comparações anteriores ficam substituídas por esta versão.
    db.run(
      "UPDATE suggestions SET review_status = 'substituida', stale_since = COALESCE(stale_since, ?) WHERE origin = 'registry_diff' AND source_file_id = ? AND review_status = 'pendente'",
      now,
      source.file_id,
    );
    const rows = sheet.rows.filter((r) => Object.values(r.cells).some((c) => c.text.trim() !== ""));
    if (rows.length === 0) warnings.push({ row: 0, id: null, message: "registro vigente sem linhas; nada foi removido" });

    for (const row of rows) {
      const id = textOf(row, map.id);
      const title = textOf(row, map.title);
      if (!id || !title) continue;
      seenIds.add(id.toUpperCase());
      const activity = db.get<Activity>("SELECT id, title, front, status, due_date, next_step FROM activities WHERE id = ? COLLATE NOCASE AND archived_at IS NULL", id);
      const status = textOf(row, map.status) ? parseStatus(textOf(row, map.status)!) : null;
      const due = parseDueDate(map.due_date ? row.cells[map.due_date] : undefined);
      const ownerIds = [
        ...new Set(
          (textOf(row, map.owners) ?? "")
            .split(/[;,]/)
            .map((n) => matchMemberByName(members, n.trim())?.id)
            .filter((m): m is string => Boolean(m)),
        ),
      ];
      const proposed: Partial<Record<RegistryField, string | string[]>> = {};
      const cell = (field: RegistryField) => `${sheet.name}!${map[field] ?? field} (linha ${row.rowNumber})`;

      if (activity) {
        const current = db.all<{ member_id: string }>("SELECT member_id FROM activity_owners WHERE activity_id = ? AND member_id IS NOT NULL", activity.id).map((o) => o.member_id);
        if (due.date !== null && due.date !== activity.due_date) proposed.due_date = due.date;
        if (status && status !== activity.status) proposed.status = status;
        const front = textOf(row, map.front);
        if (front && plain(front) !== plain(activity.front)) proposed.front = front;
        const next = textOf(row, map.next_step);
        if (next && plain(next) !== plain(activity.next_step)) proposed.next_step = next;
        if (title && plain(title) !== plain(activity.title)) proposed.title = title;
        if (ownerIds.length > 0 && (ownerIds.length !== current.length || !ownerIds.every((o) => current.includes(o)))) proposed.owners = ownerIds;
        if (Object.keys(proposed).length === 0) continue;
      } else {
        proposed.title = title;
        if (due.date) proposed.due_date = due.date;
        if (status) proposed.status = status;
        const front = textOf(row, map.front);
        if (front) proposed.front = front;
        const next = textOf(row, map.next_step);
        if (next) proposed.next_step = next;
        if (ownerIds.length > 0) proposed.owners = ownerIds;
      }

      const kind = activity ? "update" : "create";
      const key = createHash("sha256")
        .update(JSON.stringify(["registry_diff", kind, activity?.id ?? id, Object.entries(proposed).sort(([a], [b]) => a.localeCompare(b))]))
        .digest("hex");
      if (db.get("SELECT 1 AS present FROM suggestions WHERE dedupe_key = ? AND review_status = 'pendente'", key)) continue;
      const uncertainties = [activity ? "a fonte é a planilha de registro, não uma ata; confirme se a mudança vale" : `linha nova do registro (ID na planilha: ${id}); a atividade receberá um ID próprio do app`];
      const suggestionId = Number(
        db.run(
          `INSERT INTO suggestions (analysis_id, origin, kind, target_activity_id, source_file_id, source_version, doc_date, rationale,
             uncertainties_json, dedupe_key, created_at)
           VALUES (NULL, 'registry_diff', ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
          kind,
          activity?.id ?? null,
          source.file_id,
          stored.hash,
          `Nova versão do registro vigente (${source.name}, aba ${sheet.name}) difere do valor oficial.`,
          JSON.stringify(uncertainties),
          key,
          now,
        ).lastInsertRowid,
      );
      const currentValues: Record<string, unknown> = activity
        ? {
            title: activity.title,
            due_date: activity.due_date,
            status: activity.status,
            front: activity.front,
            next_step: activity.next_step,
            owners: db.all<{ member_id: string }>("SELECT member_id FROM activity_owners WHERE activity_id = ? AND member_id IS NOT NULL ORDER BY member_id", activity.id).map((o) => o.member_id),
          }
        : {};
      for (const [field, value] of Object.entries(proposed)) {
        db.run(
          "INSERT INTO suggestion_fields (suggestion_id, field, current_value_json, proposed_value_json, uncertain) VALUES (?, ?, ?, ?, 0)",
          suggestionId,
          field,
          activity ? JSON.stringify(currentValues[field] ?? null) : null,
          JSON.stringify(value),
        );
        db.run(
          "INSERT OR IGNORE INTO suggestion_evidence (suggestion_id, file_id, source_version, locator, quote) VALUES (?, ?, ?, ?, ?)",
          suggestionId,
          source.file_id,
          stored.hash,
          cell(field as RegistryField),
          `${cell(field as RegistryField)} = ${Array.isArray(value) ? value.join("; ") : value}`,
        );
      }
      suggestions++;
    }

    // Linhas que existiam e sumiram: só aviso (RN-11).
    for (const a of db.all<{ id: string }>("SELECT id FROM activities WHERE origin = 'importada' AND archived_at IS NULL")) {
      if (!seenIds.has(a.id.toUpperCase()) && rows.length > 0) {
        warnings.push({ row: 0, id: a.id, message: `linha de ${a.id} ausente na nova versão do registro — nada foi removido` });
      }
    }
    db.run(
      `INSERT INTO registry_imports (file_id, sheet, content_hash, kind, imported_at, rows_count, issues_json, snapshot_json)
       VALUES (?, ?, ?, 'diff', ?, ?, ?, '[]')`,
      source.file_id,
      sheet.name,
      stored.hash,
      now,
      rows.length,
      JSON.stringify(warnings),
    );
  });
  return { status: "compared", suggestions, warnings };
}
