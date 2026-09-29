import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "./client";

describe("openDb", () => {
  let db: Db;

  afterEach(() => db?.close());

  it("executa consultas parametrizadas", () => {
    db = openDb(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    const result = db.run("INSERT INTO t (name) VALUES (?)", "Ana");
    expect(result.changes).toBe(1);
    expect(db.get<{ name: string }>("SELECT name FROM t WHERE id = ?", 1)?.name).toBe("Ana");
    expect(db.all("SELECT * FROM t")).toHaveLength(1);
  });

  it("desfaz a transação inteira quando algo falha", () => {
    db = openDb(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    expect(() =>
      db.tx(() => {
        db.run("INSERT INTO t (name) VALUES (?)", "Ana");
        db.run("INSERT INTO t (name) VALUES (?)", null);
      }),
    ).toThrow();
    expect(db.all("SELECT * FROM t")).toHaveLength(0);
  });

  it("transações aninhadas participam da externa", () => {
    db = openDb(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
    db.tx(() => {
      db.run("INSERT INTO t (name) VALUES (?)", "Ana");
      db.tx(() => db.run("INSERT INTO t (name) VALUES (?)", "Davi"));
    });
    expect(db.all("SELECT * FROM t")).toHaveLength(2);
  });

  it("aplica chaves estrangeiras", () => {
    db = openDb(":memory:");
    db.exec("CREATE TABLE p (id INTEGER PRIMARY KEY); CREATE TABLE c (pid INTEGER REFERENCES p(id))");
    expect(() => db.run("INSERT INTO c (pid) VALUES (?)", 99)).toThrow();
  });
});
