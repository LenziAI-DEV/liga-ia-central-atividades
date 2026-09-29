import "server-only";
import type { Db } from "@/server/db/client";
import { decryptJson, encryptJson } from "./crypto";

/** Credenciais OAuth do Google (formato do google-auth-library). */
export interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  token_type?: string | null;
  id_token?: string | null;
}

export type ConnectionStatus = "connected" | "reauth_required" | "disconnected";

export interface ConnectionInfo {
  status: ConnectionStatus;
  scope: string | null;
  accountLabel: string | null;
  connectedAt: string | null;
  lastRefreshAt: string | null;
  lastErrorCode: string | null;
  hasTokens: boolean;
}

interface ConnectionRow {
  status: ConnectionStatus;
  scope: string | null;
  token_ciphertext: string | null;
  token_iv: string | null;
  token_tag: string | null;
  account_label: string | null;
  connected_at: string | null;
  last_refresh_at: string | null;
  last_error_code: string | null;
}

function readRow(db: Db): ConnectionRow | undefined {
  return db.get<ConnectionRow>("SELECT * FROM oauth_connection WHERE id = 1");
}

/** Estado da conexão Google do operador (nunca inclui tokens). */
export function getConnection(db: Db): ConnectionInfo | null {
  const row = readRow(db);
  if (!row) return null;
  return {
    status: row.status,
    scope: row.scope,
    accountLabel: row.account_label,
    connectedAt: row.connected_at,
    lastRefreshAt: row.last_refresh_at,
    lastErrorCode: row.last_error_code,
    hasTokens: Boolean(row.token_ciphertext),
  };
}

/** Lê os tokens decifrados. Se a chave mudou ou o dado está corrompido, pede reautorização. */
export function loadTokens(db: Db, key: string, now: string): StoredTokens | null {
  const row = readRow(db);
  if (!row?.token_ciphertext || !row.token_iv || !row.token_tag) return null;
  try {
    return decryptJson<StoredTokens>(
      { ciphertext: row.token_ciphertext, iv: row.token_iv, tag: row.token_tag },
      key,
    );
  } catch {
    markReauthRequired(db, "decrypt_failed", now);
    return null;
  }
}

/**
 * Grava os tokens cifrados. Uma renovação costuma vir sem `refresh_token`: nesse
 * caso o refresh token já guardado é preservado.
 */
export function saveTokens(
  db: Db,
  key: string,
  tokens: StoredTokens,
  options: { now: string; accountLabel?: string | null; newConnection?: boolean },
) {
  const row = readRow(db);
  const previous = row ? loadTokensQuietly(row, key) : null;
  const merged: StoredTokens = {
    ...previous,
    ...tokens,
    refresh_token: tokens.refresh_token ?? previous?.refresh_token ?? null,
  };
  const encrypted = encryptJson(merged, key);
  db.run(
    `INSERT INTO oauth_connection
       (id, status, scope, token_ciphertext, token_iv, token_tag, account_label, connected_at, last_refresh_at, last_error_code, updated_at)
     VALUES (1, 'connected', ?, ?, ?, ?, ?, ?, ?, NULL, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = 'connected',
       scope = excluded.scope,
       token_ciphertext = excluded.token_ciphertext,
       token_iv = excluded.token_iv,
       token_tag = excluded.token_tag,
       account_label = excluded.account_label,
       connected_at = excluded.connected_at,
       last_refresh_at = excluded.last_refresh_at,
       last_error_code = NULL,
       updated_at = excluded.updated_at`,
    merged.scope ?? row?.scope ?? null,
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.tag,
    options.accountLabel !== undefined ? options.accountLabel : (row?.account_label ?? null),
    options.newConnection || !row?.connected_at ? options.now : row.connected_at,
    options.now,
    options.now,
  );
}

/**
 * Persiste um token renovado pelo cliente durante um ciclo. Só vale para uma
 * conexão ainda ativa: se o operador desconectou (ou a autorização caiu) no meio do
 * ciclo, a renovação não pode reativá-la. Verificação e escrita são síncronas.
 */
export function saveRefreshedTokens(db: Db, key: string, tokens: StoredTokens, now: string) {
  if (readRow(db)?.status !== "connected") return;
  saveTokens(db, key, tokens, { now });
}

function loadTokensQuietly(row: ConnectionRow, key: string): StoredTokens | null {
  if (!row.token_ciphertext || !row.token_iv || !row.token_tag) return null;
  try {
    return decryptJson<StoredTokens>({ ciphertext: row.token_ciphertext, iv: row.token_iv, tag: row.token_tag }, key);
  } catch {
    return null;
  }
}

/** Só uma conexão ativa passa a "reautorizar": um ciclo antigo não desfaz um "Desconectar". */
export function markReauthRequired(db: Db, errorCode: string, now: string) {
  db.run(
    `UPDATE oauth_connection SET status = 'reauth_required', last_error_code = ?, updated_at = ?
     WHERE id = 1 AND status = 'connected'`,
    errorCode,
    now,
  );
}

/** Desconecta: apaga os tokens do banco (a revogação no Google é feita antes, se possível). */
export function markDisconnected(db: Db, now: string) {
  db.run(
    `UPDATE oauth_connection SET status = 'disconnected', token_ciphertext = NULL, token_iv = NULL,
       token_tag = NULL, last_error_code = NULL, updated_at = ? WHERE id = 1`,
    now,
  );
}
