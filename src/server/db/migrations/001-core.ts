import type { Migration } from "./index";

/**
 * Núcleo: configuração, conexão OAuth, membros, fontes do Drive e execuções de sync.
 * Instantes em TEXT UTC ISO-8601; prazos em TEXT AAAA-MM-DD (ARCHITECTURE §8).
 */
export const migration001Core: Migration = {
  version: 1,
  name: "core",
  sql: `
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE oauth_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL CHECK (status IN ('connected', 'reauth_required', 'disconnected')),
  scope TEXT,
  token_ciphertext TEXT,
  token_iv TEXT,
  token_tag TEXT,
  key_version INTEGER NOT NULL DEFAULT 1,
  account_label TEXT,
  connected_at TEXT,
  last_refresh_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  front TEXT,
  role TEXT NOT NULL CHECK (role IN ('member', 'reviewer')),
  aliases_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE sources (
  file_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('md', 'xlsx', 'gdoc', 'folder', 'shortcut', 'unsupported')),
  web_url TEXT,
  modified_time TEXT,
  drive_version TEXT,
  md5_checksum TEXT,
  size INTEGER,
  parent_id TEXT,
  path TEXT NOT NULL,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'processed', 'failed', 'unsupported', 'unavailable', 'out_of_scope')),
  status_reason TEXT,
  processed_hash TEXT,
  processed_drive_version TEXT,
  last_processed_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  removed_at TEXT,
  authority_class TEXT CHECK (authority_class IN ('direcao_ativo', 'direcao_parcial', 'registro_vigente', 'ata', 'historico', 'sem_autoridade')),
  authority_reason TEXT,
  doc_date TEXT
);
CREATE INDEX idx_sources_parent ON sources (parent_id);
CREATE INDEX idx_sources_status ON sources (sync_status);

-- Só a versão vigente do conteúdo extraído (mínimo necessário, AR-18).
CREATE TABLE source_contents (
  file_id TEXT PRIMARY KEY REFERENCES sources (file_id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  extracted_json TEXT NOT NULL,
  extracted_at TEXT NOT NULL,
  byte_size INTEGER NOT NULL
);

-- Histórico de versões processadas, sem conteúdo.
CREATE TABLE source_versions (
  file_id TEXT NOT NULL REFERENCES sources (file_id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  drive_version TEXT,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (file_id, content_hash)
);

CREATE TABLE sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('initial', 'scheduled', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  lease_until TEXT,
  counts_json TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_message TEXT
);
CREATE INDEX idx_sync_runs_started ON sync_runs (started_at);
`,
};
