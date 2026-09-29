import { NextResponse, type NextRequest } from "next/server";
import { createAuthorizationRequest } from "@/server/auth/google-oauth";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_COOKIE_PATH,
  encodeOAuthCookie,
} from "@/server/auth/oauth-cookie";
import { getEnv, missingGoogleSettings } from "@/server/config/env";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";

/** Inicia a autorização com o Google (fluxo web server com state + PKCE, [GUIA §3]). */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const base = new URL(env.APP_BASE_URL);

  if (missingGoogleSettings(env).length > 0) {
    return NextResponse.redirect(new URL("/sincronizacao?erro=config", base));
  }
  // Host canônico: o cookie de state precisa voltar no mesmo host do callback cadastrado.
  if (request.nextUrl.host !== base.host) {
    return NextResponse.redirect(new URL("/api/auth/google/start", base));
  }

  try {
    const { url, state, codeVerifier } = await createAuthorizationRequest(env);
    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_COOKIE, encodeOAuthCookie({ state, codeVerifier }), {
      httpOnly: true,
      sameSite: "lax",
      secure: base.protocol === "https:",
      path: OAUTH_COOKIE_PATH,
      maxAge: OAUTH_COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    logger.error("oauth.start_failed", { error });
    return NextResponse.redirect(new URL("/sincronizacao?erro=inicio", base));
  }
}
