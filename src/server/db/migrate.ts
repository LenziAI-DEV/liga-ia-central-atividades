import type { Db } from "./client";
import { MIGRATIONS, type Migration } from "./migrations";

/** Aplica, em ordem e cada uma em sua transação, as migrações ainda não aplicadas. */
export function migrate(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
  now: () => string = () => new Date().toISOString(),
): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    db.all<{ version: number }>("SELECT version FROM schema_migrations").map((row) => row.version),
  );
  const newlyApplied: number[] = [];
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(migration.version)) continue;
    db.tx(() => {
      db.exec(migration.sql);
      db.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        migration.version,
        migration.name,
        now(),
      );
    });
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}
