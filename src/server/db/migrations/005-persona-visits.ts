import type { Migration } from "./index";

/** Última visita a "O que mudou para mim", por persona (DN-10). Só datas, nenhum conteúdo. */
export const migration005PersonaVisits: Migration = {
  version: 5,
  name: "persona-visits",
  sql: `
CREATE TABLE persona_visits (
  member_id TEXT PRIMARY KEY,
  last_visit_at TEXT NOT NULL,
  previous_visit_at TEXT
);
`,
};
