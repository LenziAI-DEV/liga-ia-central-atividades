import { openDb, type Db } from "./client";
import { migrate } from "./migrate";

const globalForDb = globalThis as unknown as { __liaDb?: Db };

/** Conexão única por processo (sobrevive ao HMR do `next dev`), já com o esquema migrado. */
export function getDb(): Db {
  if (!globalForDb.__liaDb) {
    const db = openDb(process.env.DATABASE_PATH || "data/app.db");
    migrate(db);
    globalForDb.__liaDb = db;
  }
  return globalForDb.__liaDb;
}

export type { Db } from "./client";
