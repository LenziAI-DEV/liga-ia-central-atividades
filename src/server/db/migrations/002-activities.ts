import type { Migration } from "./index";

/**
 * Atividades oficiais, responsáveis, referências, eventos (append-only) e importações
 * do registro (ARCHITECTURE §8.1). `activities` guarda só o valor oficial (ADR-12).
 */
export const migration002Activities: Migration = {
  version: 2,
  name: "activities",
  sql: `
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  next_step TEXT,
  front TEXT,
  status TEXT CHECK (status IS NULL OR status IN ('a_fazer', 'em_andamento', 'bloqueada', 'concluida')),
  due_date TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  priority TEXT,
  notes TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('importada', 'manual', 'sugestao')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  archived_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_activities_status ON activities (status);
CREATE INDEX idx_activities_front ON activities (front);
CREATE INDEX idx_activities_due ON activities (due_date);

CREATE TABLE activity_owners (
  activity_id TEXT NOT NULL REFERENCES activities (id),
  member_id TEXT,
  raw_name TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_activity_owners_unique ON activity_owners (activity_id, COALESCE(member_id, raw_name));
CREATE INDEX idx_activity_owners_member ON activity_owners (member_id);

CREATE TABLE activity_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id TEXT NOT NULL REFERENCES activities (id),
  file_id TEXT NOT NULL,
  source_version TEXT NOT NULL DEFAULT '',
  locator TEXT NOT NULL DEFAULT '',
  quote_or_cell TEXT,
  relation TEXT NOT NULL CHECK (relation IN ('imported_from', 'historical_origin', 'updated_by', 'created_by')),
  created_at TEXT NOT NULL,
  UNIQUE (activity_id, file_id, source_version, relation, locator)
);

CREATE TABLE activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id TEXT NOT NULL REFERENCES activities (id),
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'imported', 'updated', 'suggestion_applied', 'archived')),
  changes_json TEXT NOT NULL DEFAULT '[]',
  reason TEXT,
  suggestion_id INTEGER,
  source_file_id TEXT,
  source_version TEXT
);
CREATE INDEX idx_activity_events_activity ON activity_events (activity_id, occurred_at);
CREATE INDEX idx_activity_events_time ON activity_events (occurred_at);
CREATE TRIGGER activity_events_no_update BEFORE UPDATE ON activity_events
BEGIN SELECT RAISE(ABORT, 'activity_events é append-only'); END;
CREATE TRIGGER activity_events_no_delete BEFORE DELETE ON activity_events
BEGIN SELECT RAISE(ABORT, 'activity_events é append-only'); END;

CREATE TABLE id_sequences (
  prefix TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL
);

CREATE TABLE registry_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL,
  sheet TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('initial', 'diff')),
  imported_at TEXT NOT NULL,
  rows_count INTEGER NOT NULL,
  issues_json TEXT NOT NULL DEFAULT '[]',
  snapshot_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE (file_id, content_hash)
);
`,
};
