import { openDb, type Db } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";

/** Banco SQLite em memória com o esquema completo. */
export function testDb(): Db {
  const db = openDb(":memory:");
  migrate(db);
  return db;
}

/** Relógio que avança 1 s a cada leitura (ordenação estável de eventos em testes). */
export function steppingClock(start = "2026-09-29T12:00:00.000Z") {
  let t = Date.parse(start);
  return {
    now: () => {
      t += 1000;
      return new Date(t);
    },
  };
}
