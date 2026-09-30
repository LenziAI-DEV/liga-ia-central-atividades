import type { SourceKind } from "@/server/drive/classify-file";
import type { WalkedItem } from "@/server/drive/walk-tree";
import type { Extracted } from "@/server/extract/types";
import type { Db } from "../client";

export type SyncStatus = "pending" | "processed" | "failed" | "unsupported" | "unavailable" | "out_of_scope";

export interface SourceRow {
  file_id: string;
  name: string;
  mime_type: string;
  kind: SourceKind;
  web_url: string | null;
  modified_time: string | null;
  drive_version: string | null;
  md5_checksum: string | null;
  size: number | null;
  parent_id: string | null;
  path: string;
  sync_status: SyncStatus;
  status_reason: string | null;
  processed_hash: string | null;
  processed_drive_version: string | null;
  last_processed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  removed_at: string | null;
  authority_class: string | null;
  authority_reason: string | null;
  doc_date: string | null;
}

export function getSource(db: Db, fileId: string): SourceRow | undefined {
  return db.get<SourceRow>("SELECT * FROM sources WHERE file_id = ?", fileId);
}

export function listSources(db: Db): SourceRow[] {
  return db.all<SourceRow>("SELECT * FROM sources ORDER BY path COLLATE NOCASE");
}

/** Fontes ainda consideradas presentes (não indisponíveis nem fora da pasta). */
export function listTrackedSources(db: Db): SourceRow[] {
  return db.all<SourceRow>("SELECT * FROM sources WHERE sync_status NOT IN ('unavailable', 'out_of_scope')");
}

export function listTrackedChildren(db: Db, parentId: string): SourceRow[] {
  return db.all<SourceRow>(
    "SELECT * FROM sources WHERE parent_id = ? AND sync_status NOT IN ('unavailable', 'out_of_scope')",
    parentId,
  );
}

/**
 * Registra que o item foi visto na árvore. Mantém o identificador (rename preserva
 * histórico, CA-F3.3). Um item que volta depois de indisponível é reprocessado.
 */
export function upsertSeen(db: Db, item: WalkedItem, kind: SourceKind, now: string) {
  db.run(
    `INSERT INTO sources (file_id, name, mime_type, kind, web_url, modified_time, drive_version, md5_checksum,
       size, parent_id, path, sync_status, status_reason, first_seen_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(file_id) DO UPDATE SET
       name = excluded.name,
       mime_type = excluded.mime_type,
       kind = excluded.kind,
       web_url = excluded.web_url,
       modified_time = excluded.modified_time,
       drive_version = excluded.drive_version,
       md5_checksum = excluded.md5_checksum,
       size = excluded.size,
       parent_id = excluded.parent_id,
       path = excluded.path,
       last_seen_at = excluded.last_seen_at,
       removed_at = NULL,
       processed_drive_version = CASE WHEN sources.sync_status IN ('unavailable', 'out_of_scope') THEN NULL ELSE sources.processed_drive_version END,
       sync_status = CASE WHEN sources.sync_status IN ('unavailable', 'out_of_scope') THEN 'pending' ELSE sources.sync_status END`,
    item.id,
    item.name,
    item.mimeType,
    kind,
    item.webViewLink,
    item.modifiedTime,
    item.version,
    item.md5Checksum,
    item.size,
    item.parentId,
    item.path,
    now,
    now,
  );
}

export function setStatus(db: Db, fileId: string, status: SyncStatus, reason: string | null) {
  db.run("UPDATE sources SET sync_status = ?, status_reason = ? WHERE file_id = ?", status, reason, fileId);
}

export function markProcessed(
  db: Db,
  fileId: string,
  data: { hash: string; driveVersion: string | null; now: string; docDate: string | null },
) {
  db.run(
    `UPDATE sources SET sync_status = 'processed', status_reason = NULL, processed_hash = ?,
       processed_drive_version = ?, last_processed_at = ?, doc_date = ? WHERE file_id = ?`,
    data.hash,
    data.driveVersion,
    data.now,
    data.docDate,
    fileId,
  );
}

/** Guarda só a versão vigente do conteúdo extraído (AR-18). */
export function saveContent(db: Db, fileId: string, hash: string, extracted: Extracted, now: string) {
  const json = JSON.stringify(extracted);
  db.run(
    `INSERT INTO source_contents (file_id, content_hash, extracted_json, extracted_at, byte_size)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(file_id) DO UPDATE SET content_hash = excluded.content_hash,
       extracted_json = excluded.extracted_json, extracted_at = excluded.extracted_at, byte_size = excluded.byte_size`,
    fileId,
    hash,
    json,
    now,
    Buffer.byteLength(json),
  );
}

export function getContent(db: Db, fileId: string): { hash: string; extracted: Extracted } | undefined {
  const row = db.get<{ content_hash: string; extracted_json: string }>(
    "SELECT content_hash, extracted_json FROM source_contents WHERE file_id = ?",
    fileId,
  );
  return row ? { hash: row.content_hash, extracted: JSON.parse(row.extracted_json) as Extracted } : undefined;
}

export function hasContent(db: Db, fileId: string): boolean {
  return db.get("SELECT 1 AS present FROM source_contents WHERE file_id = ?", fileId) !== undefined;
}

export function deleteContent(db: Db, fileId: string) {
  db.run("DELETE FROM source_contents WHERE file_id = ?", fileId);
}

export function recordVersion(db: Db, fileId: string, hash: string, driveVersion: string | null, now: string) {
  db.run(
    "INSERT OR IGNORE INTO source_versions (file_id, content_hash, drive_version, processed_at) VALUES (?, ?, ?, ?)",
    fileId,
    hash,
    driveVersion,
    now,
  );
}

export function countVersions(db: Db, fileId: string): number {
  return db.get<{ n: number }>("SELECT COUNT(*) AS n FROM source_versions WHERE file_id = ?", fileId)?.n ?? 0;
}

/** Fonte removida, sem acesso ou fora da pasta: marca e apaga o conteúdo em cache (F3.4, AR-18). */
export function markGone(db: Db, fileId: string, status: "unavailable" | "out_of_scope", reason: string, now: string) {
  db.tx(() => {
    db.run(
      "UPDATE sources SET sync_status = ?, status_reason = ?, removed_at = ? WHERE file_id = ?",
      status,
      reason,
      now,
      fileId,
    );
    deleteContent(db, fileId);
  });
}
