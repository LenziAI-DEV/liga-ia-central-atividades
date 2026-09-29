import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DatabaseSync, StatementSync } from "node:sqlite";

export type SqlParam = string | number | bigint | null | Uint8Array;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/** Porta de acesso ao banco. Só este módulo conhece o driver (ADR-03). */
export interface Db {
  get<T>(sql: string, ...params: SqlParam[]): T | undefined;
  all<T>(sql: string, ...params: SqlParam[]): T[];
  run(sql: string, ...params: SqlParam[]): RunResult;
  exec(sql: string): void;
  /** Transação `BEGIN IMMEDIATE`; chamadas aninhadas participam da transação externa. */
  tx<T>(fn: () => T): T;
  close(): void;
}

type SqliteModule = typeof import("node:sqlite");

/**
 * Carrega `node:sqlite` em tempo de execução, sem passar pelo bundler do Next
 * (risco RT-A da ARCHITECTURE). Exige Node >= 22.13.
 */
function loadSqlite(): SqliteModule {
  const mod = process.getBuiltinModule?.("node:sqlite") as SqliteModule | undefined;
  if (!mod) {
    throw new Error(
      "Este projeto exige Node.js 22.13 ou superior (módulo node:sqlite indisponível). Instale o Node 24 LTS.",
    );
  }
  return mod;
}

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const { DatabaseSync: Database } = loadSqlite();
  const db: DatabaseSync = new Database(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  const statements = new Map<string, StatementSync>();
  const prepare = (sql: string): StatementSync => {
    let stmt = statements.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      statements.set(sql, stmt);
    }
    return stmt;
  };

  let txDepth = 0;
  let closed = false;

  return {
    get<T>(sql: string, ...params: SqlParam[]) {
      return prepare(sql).get(...params) as T | undefined;
    },
    all<T>(sql: string, ...params: SqlParam[]) {
      return prepare(sql).all(...params) as T[];
    },
    run(sql: string, ...params: SqlParam[]) {
      const result = prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
    },
    exec(sql: string) {
      db.exec(sql);
    },
    tx<T>(fn: () => T): T {
      if (txDepth > 0) return fn();
      db.exec("BEGIN IMMEDIATE");
      txDepth++;
      try {
        const value = fn();
        db.exec("COMMIT");
        return value;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      } finally {
        txDepth--;
      }
    },
    close() {
      if (closed) return;
      closed = true;
      statements.clear();
      db.close();
    },
  };
}
