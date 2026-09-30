import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client, type Credentials } from "google-auth-library";
import { DRIVE_READONLY_SCOPE, type AppEnv } from "@/server/config/env";
import type { Db } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { loadTokens, markDisconnected, saveRefreshedTokens } from "./token-store";

/** Cliente OAuth do fluxo web server, executado só no servidor ([GUIA §3]). */
export function createOAuthClient(env: AppEnv): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("config_missing", "Credenciais do Google ausentes no .env.local (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).");
  }
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  });
}

/** URL de consentimento com `state` (CSRF) e PKCE S256; escopo somente leitura. */
export async function createAuthorizationRequest(env: AppEnv) {
  const client = createOAuthClient(env);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  if (!codeChallenge) throw new AppError("pkce_failed", "Não foi possível preparar a autorização (PKCE).");
  const state = randomBytes(32).toString("base64url");
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: false,
    scope: [DRIVE_READONLY_SCOPE],
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
  });
  return { url, state, codeVerifier };
}

/** Comparação de `state` em tempo constante. */
export function statesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeCode(env: AppEnv, code: string, codeVerifier: string): Promise<Credentials> {
  const { tokens } = await createOAuthClient(env).getToken({ code, codeVerifier });
  return tokens;
}

/** Escopos de identidade que podem vir junto sem dar acesso a arquivos. */
const IDENTITY_SCOPES = new Set([
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

/**
 * Aceita só leitura do Drive (ADR-07): exige `drive.readonly` e recusa qualquer
 * outro escopo além dos de identidade — inclusive Documentos/Planilhas, que
 * permitem escrever em arquivos.
 */
export function assertReadonlyScope(scope: string | null | undefined) {
  const granted = (scope ?? "").split(/\s+/).filter(Boolean);
  if (!granted.includes(DRIVE_READONLY_SCOPE)) {
    throw new AppError("escopo_invalido", "A autorização não incluiu a leitura do Drive. Conecte de novo e aceite o acesso solicitado.");
  }
  const extra = granted.filter((s) => s !== DRIVE_READONLY_SCOPE && !IDENTITY_SCOPES.has(s));
  if (extra.length > 0) {
    throw new AppError("escopo_invalido", "A autorização concedeu mais do que leitura do Drive; este app aceita somente leitura.");
  }
}

/** Cliente autorizado com os tokens guardados; renovações são persistidas cifradas. */
export function authorizedClient(db: Db, env: AppEnv): OAuth2Client | null {
  const key = env.APP_ENCRYPTION_KEY;
  if (!key) return null;
  const tokens = loadTokens(db, key, new Date().toISOString());
  if (!tokens?.refresh_token && !tokens?.access_token) return null;
  const client = createOAuthClient(env);
  client.setCredentials({ ...tokens, scope: tokens.scope ?? undefined });
  client.on("tokens", (fresh) => {
    try {
      saveRefreshedTokens(db, key, fresh, new Date().toISOString());
    } catch (error) {
      logger.warn("oauth.token_persist_failed", { error });
    }
  });
  return client;
}

/**
 * Revoga a concessão no Google. Devolve `false` quando não foi possível (sem rede,
 * erro do Google, token ilegível): a interface precisa dizer isso ao operador.
 */
export async function revokeGrant(env: AppEnv, tokens: Pick<Credentials, "refresh_token" | "access_token"> | null) {
  const token = tokens?.refresh_token ?? tokens?.access_token;
  if (!token) return false;
  try {
    await createOAuthClient(env).revokeToken(token);
    return true;
  } catch (error) {
    logger.warn("oauth.revoke_failed", { error });
    return false;
  }
}

/** Revoga no Google e apaga os tokens locais ([GUIA §12]); informa se a revogação remota funcionou. */
export async function revokeConnection(db: Db, env: AppEnv): Promise<{ revoked: boolean }> {
  const now = new Date().toISOString();
  const tokens = env.APP_ENCRYPTION_KEY ? loadTokens(db, env.APP_ENCRYPTION_KEY, now) : null;
  const revoked = await revokeGrant(env, tokens);
  markDisconnected(db, now);
  logger.info("oauth.disconnected", { revoked });
  return { revoked };
}
