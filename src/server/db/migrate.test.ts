import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "./client";
import { migrate } from "./migrate";
import { MIGRATIONS } from "./migrations";

describe("migrate", () => {
  let db: Db;
  afterEach(() => db?.close());

  it("aplica todas as migrações e é idempotente", () => {
    db = openDb(":memory:");
    expect(migrate(db)).toEqual(MIGRATIONS.map((m) => m.version));
    expect(migrate(db)).toEqual([]);
    const tables = db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((t) => t.name);
    expect(tables).toEqual(
      expect.arrayContaining(["sources", "source_contents", "source_versions", "sync_runs", "oauth_connection", "members"]),
    );
  });

  it("versões são únicas e crescentes", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
  });

  it("desfaz uma migração com erro sem registrá-la", () => {
    db = openDb(":memory:");
    const broken = [{ version: 99, name: "quebrada", sql: "CREATE TABLE ok (id INTEGER); INVALID SQL;" }];
    expect(() => migrate(db, broken)).toThrow();
    expect(db.get("SELECT version FROM schema_migrations WHERE version = 99")).toBeUndefined();
    expect(db.get("SELECT name FROM sqlite_master WHERE name = 'ok'")).toBeUndefined();
  });

  it("recusa valores fora do domínio (CHECK)", () => {
    db = openDb(":memory:");
    migrate(db);
    expect(() =>
      db.run(
        "INSERT INTO sync_runs (trigger_kind, status, started_at) VALUES (?, ?, ?)",
        "manual",
        "desconhecido",
        "2026-09-29T00:00:00Z",
      ),
    ).toThrow();
  });
});
