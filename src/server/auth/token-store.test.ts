import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testDb } from "../../../tests/helpers/db";
import {
  getConnection,
  loadTokens,
  markDisconnected,
  markReauthRequired,
  saveRefreshedTokens,
  saveTokens,
} from "./token-store";

const key = randomBytes(32).toString("base64");
const now = "2026-09-29T12:00:00.000Z";

describe("token-store", () => {
  it("grava cifrado e lê de volta; o banco não guarda o token em claro", () => {
    const db = testDb();
    saveTokens(db, key, { access_token: "ya29.x", refresh_token: "1//r", scope: "s" }, { now, accountLabel: "Ana", newConnection: true });
    expect(loadTokens(db, key, now)).toMatchObject({ access_token: "ya29.x", refresh_token: "1//r" });
    const raw = JSON.stringify(db.all("SELECT * FROM oauth_connection"));
    expect(raw).not.toContain("1//r");
    expect(getConnection(db)).toMatchObject({ status: "connected", accountLabel: "Ana", connectedAt: now, hasTokens: true });
  });

  it("renovação sem refresh_token preserva o refresh token guardado", () => {
    const db = testDb();
    saveTokens(db, key, { access_token: "a1", refresh_token: "1//r" }, { now, newConnection: true });
    saveTokens(db, key, { access_token: "a2" }, { now: "2026-09-29T13:00:00.000Z" });
    expect(loadTokens(db, key, now)).toMatchObject({ access_token: "a2", refresh_token: "1//r" });
    expect(getConnection(db)?.connectedAt).toBe(now);
  });

  it("chave diferente → pede reautorização em vez de falhar", () => {
    const db = testDb();
    saveTokens(db, key, { refresh_token: "1//r" }, { now, newConnection: true });
    expect(loadTokens(db, randomBytes(32).toString("base64"), now)).toBeNull();
    expect(getConnection(db)).toMatchObject({ status: "reauth_required", lastErrorCode: "decrypt_failed" });
  });

  it("renovação durante um ciclo não reativa uma conexão já encerrada (M-5)", () => {
    const db = testDb();
    saveTokens(db, key, { access_token: "a1", refresh_token: "1//r" }, { now, newConnection: true });
    markDisconnected(db, now);
    saveRefreshedTokens(db, key, { access_token: "a2" }, now);
    expect(getConnection(db)).toMatchObject({ status: "disconnected", hasTokens: false });

    saveTokens(db, key, { access_token: "a1", refresh_token: "1//r" }, { now, newConnection: true });
    markReauthRequired(db, "invalid_grant", now);
    saveRefreshedTokens(db, key, { access_token: "a3" }, now);
    expect(getConnection(db)?.status).toBe("reauth_required");
  });

  it("renovação com a conexão ativa é persistida", () => {
    const db = testDb();
    saveTokens(db, key, { access_token: "a1", refresh_token: "1//r" }, { now, newConnection: true });
    saveRefreshedTokens(db, key, { access_token: "a2" }, now);
    expect(loadTokens(db, key, now)).toMatchObject({ access_token: "a2", refresh_token: "1//r" });
  });

  it("falha de autenticação de um ciclo antigo não troca 'desconectado' por 'reautorizar'", () => {
    const db = testDb();
    saveTokens(db, key, { refresh_token: "1//r" }, { now, newConnection: true });
    markDisconnected(db, now);
    markReauthRequired(db, "invalid_grant", now);
    expect(getConnection(db)?.status).toBe("disconnected");
  });

  it("reautorização e desconexão (sem guardar e-mail nem escopo depois)", () => {
    const db = testDb();
    saveTokens(db, key, { refresh_token: "1//r", scope: "s" }, { now, accountLabel: "ana@example.com", newConnection: true });
    markReauthRequired(db, "invalid_grant", now);
    expect(getConnection(db)?.status).toBe("reauth_required");
    markDisconnected(db, now);
    expect(getConnection(db)).toMatchObject({ status: "disconnected", hasTokens: false, accountLabel: null, scope: null });
    expect(loadTokens(db, key, now)).toBeNull();
  });
});
