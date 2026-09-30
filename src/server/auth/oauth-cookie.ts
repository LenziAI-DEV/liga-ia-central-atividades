/** Cookie temporário do fluxo OAuth: guarda `state` e `code_verifier` (PKCE) por 10 min. */
export const OAUTH_COOKIE = "lia_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";
export const OAUTH_COOKIE_MAX_AGE = 600;

export interface OAuthCookie {
  state: string;
  codeVerifier: string;
}

export function encodeOAuthCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthCookie>;
    return typeof value.state === "string" && typeof value.codeVerifier === "string"
      ? { state: value.state, codeVerifier: value.codeVerifier }
      : null;
  } catch {
    return null;
  }
}
