import type { Migration } from "./index";

/**
 * Análises por IA, sugestões com evidência e chamadas ao modelo (ARCHITECTURE §8.1).
 * `ai_calls` guarda só contagens e custo, nunca o conteúdo dos documentos.
 */
export const migration004Ai: Migration = {
  version: 4,
  name: "ai",
  sql: `
CREATE TABLE document_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  analyzer_version TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('extract', 'direction_digest')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'waiting_registry', 'running', 'done', 'failed', 'disabled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  error_code TEXT,
  error_message TEXT,
  document_summary TEXT,
  no_action_json TEXT NOT NULL DEFAULT '[]',
  invalid_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  finished_at TEXT,
  UNIQUE (file_id, content_hash, analyzer_version, purpose)
);
CREATE INDEX idx_analyses_status ON document_analyses (status);

CREATE TABLE suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER REFERENCES document_analyses (id),
  origin TEXT NOT NULL CHECK (origin IN ('ai', 'registry_diff')),
  kind TEXT NOT NULL CHECK (kind IN ('create', 'update')),
  target_activity_id TEXT REFERENCES activities (id),
  source_file_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  doc_date TEXT,
  rationale TEXT,
  uncertainties_json TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'pendente' CHECK (review_status IN ('pendente', 'aceita', 'ajustada', 'rejeitada', 'substituida')),
  stale_since TEXT,
  superseded_by INTEGER,
  dedupe_key TEXT NOT NULL,
  reviewer_id TEXT,
  reviewed_at TEXT,
  review_reason TEXT,
  applied_event_id INTEGER,
  created_activity_id TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_suggestions_pending_dedupe ON suggestions (dedupe_key) WHERE review_status = 'pendente';
CREATE INDEX idx_suggestions_target ON suggestions (target_activity_id);
CREATE INDEX idx_suggestions_source ON suggestions (source_file_id, source_version);
CREATE INDEX idx_suggestions_status ON suggestions (review_status);

CREATE TABLE suggestion_fields (
  suggestion_id INTEGER NOT NULL REFERENCES suggestions (id),
  field TEXT NOT NULL CHECK (field IN ('title', 'description', 'next_step', 'owners', 'front', 'status', 'due_date')),
  current_value_json TEXT,
  proposed_value_json TEXT NOT NULL,
  final_value_json TEXT,
  uncertain INTEGER NOT NULL DEFAULT 0,
  adjusted_by_reviewer INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (suggestion_id, field)
);

CREATE TABLE suggestion_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion_id INTEGER NOT NULL REFERENCES suggestions (id),
  file_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  locator TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  UNIQUE (suggestion_id, file_id, source_version, quote)
);

CREATE TABLE ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_code TEXT,
  cost_estimate_usd REAL,
  created_at TEXT NOT NULL
);
`,
};
