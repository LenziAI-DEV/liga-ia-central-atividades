import "server-only";
import { openDb, type Db } from "./client";

const globalForDb = globalThis as unknown as { __liaDb?: Db };

/** Conexão única por processo (sobrevive ao HMR do `next dev`). */
export function getDb(): Db {
  if (!globalForDb.__liaDb) {
    globalForDb.__liaDb = openDb(process.env.DATABASE_PATH || "data/app.db");
  }
  return globalForDb.__liaDb;
}

export type { Db } from "./client";
