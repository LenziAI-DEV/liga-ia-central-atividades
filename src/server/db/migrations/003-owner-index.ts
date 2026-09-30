import type { Migration } from "./index";

/**
 * O índice único de responsáveis comparava `member_id` com nome bruto na mesma expressão;
 * um nome bruto igual ao ID de um membro colidiria. O prefixo separa os dois espaços.
 */
export const migration003OwnerIndex: Migration = {
  version: 3,
  name: "owner-index",
  sql: `
DROP INDEX idx_activity_owners_unique;
CREATE UNIQUE INDEX idx_activity_owners_unique
  ON activity_owners (activity_id, COALESCE('m:' || member_id, 'r:' || raw_name));
`,
};
