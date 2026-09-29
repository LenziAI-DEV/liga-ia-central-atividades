import { randomBytes, timingSafeEqual } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client, type Credentials } from "google-auth-library";
import { DRIVE_READONLY_SCOPE, type AppEnv } from "@/server/config/env";
import type { Db } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { loadTokens, markDisconnected, saveTokens } from "./token-store";

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

/** Aceita só leitura do Drive: recusa autorização sem `drive.readonly` ou com escopo de escrita. */
export function assertReadonlyScope(scope: string | null | undefined) {
  const granted = (scope ?? "").split(/\s+/).filter(Boolean);
  if (!granted.includes(DRIVE_READONLY_SCOPE)) {
    throw new AppError("escopo_invalido", "A autorização não incluiu a leitura do Drive. Conecte de novo e aceite o acesso solicitado.");
  }
  const broad = granted.filter(
    (s) => s.startsWith("https://www.googleapis.com/auth/drive") && !s.endsWith(".readonly"),
  );
  if (broad.length > 0) {
    throw new AppError("escopo_invalido", "A autorização concedeu acesso de escrita ao Drive; este app aceita somente leitura.");
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
      saveTokens(db, key, fresh, { now: new Date().toISOString() });
    } catch (error) {
      logger.warn("oauth.token_persist_failed", { error });
    }
  });
  return client;
}

/** Revoga no Google (melhor esforço) e apaga os tokens locais ([GUIA §12]). */
export async function revokeConnection(db: Db, env: AppEnv) {
  const now = new Date().toISOString();
  const tokens = env.APP_ENCRYPTION_KEY ? loadTokens(db, env.APP_ENCRYPTION_KEY, now) : null;
  const token = tokens?.refresh_token ?? tokens?.access_token;
  if (token) {
    try {
      await createOAuthClient(env).revokeToken(token);
    } catch (error) {
      logger.warn("oauth.revoke_failed", { error });
    }
  }
  markDisconnected(db, now);
  logger.info("oauth.disconnected");
}
