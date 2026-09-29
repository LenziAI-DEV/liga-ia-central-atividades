import { after, NextResponse, type NextRequest } from "next/server";
import {
  assertReadonlyScope,
  createOAuthClient,
  exchangeCode,
  statesMatch,
} from "@/server/auth/google-oauth";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, decodeOAuthCookie } from "@/server/auth/oauth-cookie";
import { saveTokens } from "@/server/auth/token-store";
import { getEnv } from "@/server/config/env";
import { requestSync } from "@/server/container";
import { getDb } from "@/server/db";
import { SETTING, getSetting, setSetting } from "@/server/db/repos/settings-repo";
import { DriveError } from "@/server/drive/errors";
import { MIME } from "@/server/drive/gateway";
import { GoogleDriveGateway } from "@/server/drive/google-drive-gateway";
import { AppError } from "@/server/errors";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";

/**
 * Retorno do Google: valida `state`, troca o código (com PKCE) no servidor, exige
 * escopo somente leitura, confere a pasta configurada e grava os tokens cifrados.
 * Nenhum código, token ou URL de autorização é registrado em log ([GUIA §10]).
 */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const base = new URL(env.APP_BASE_URL);
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, base));
    response.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
    return response;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish("/sincronizacao?erro=acesso_negado");

  const code = params.get("code");
  const state = params.get("state");
  const saved = decodeOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  if (!code || !state || !saved || !statesMatch(saved.state, state)) {
    return finish("/sincronizacao?erro=state_invalido");
  }

  try {
    const tokens = await exchangeCode(env, code, saved.codeVerifier);
    assertReadonlyScope(tokens.scope);

    const client = createOAuthClient(env);
    client.setCredentials(tokens);
    const gateway = new GoogleDriveGateway(client);

    let folder;
    try {
      folder = await gateway.getItem(env.DRIVE_TEST_FOLDER_ID!);
    } catch (error) {
      if (error instanceof DriveError && (error.kind === "not_found" || error.kind === "forbidden")) {
        return finish("/sincronizacao?erro=pasta_inacessivel");
      }
      throw error;
    }
    if (folder.mimeType !== MIME.folder) return finish("/sincronizacao?erro=pasta_invalida");

    const account = await gateway.getAccount().catch(() => ({ displayName: null, email: null }));
    const db = getDb();
    const now = new Date().toISOString();
    saveTokens(db, env.APP_ENCRYPTION_KEY!, tokens, {
      now,
      accountLabel: account.email ?? account.displayName,
      newConnection: true,
    });
    setSetting(db, SETTING.rootFolder, { id: folder.id, name: folder.name, url: folder.webViewLink }, now);
    if (!getSetting(db, SETTING.firstLoadStartedAt)) setSetting(db, SETTING.firstLoadStartedAt, now, now);
    logger.info("oauth.connected");
  } catch (error) {
    logger.warn("oauth.callback_failed", { error });
    return finish(`/sincronizacao?erro=${error instanceof AppError ? error.code : "troca_falhou"}`);
  }

  // Carga inicial logo após conectar, sem segurar a resposta.
  after(async () => {
    await requestSync("initial");
  });
  return finish("/sincronizacao?conectado=1");
}
