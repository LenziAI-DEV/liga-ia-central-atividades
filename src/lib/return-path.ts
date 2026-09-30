/**
 * Caminho local para voltar depois de uma ação: só o do mesmo host e sempre relativo
 * à raiz. `//evil.com` e `/\evil.com` seriam lidos como endereço externo; viram "/".
 */
export function sameSiteReturnPath(referer: string | null, host: string | null): string {
  if (!referer || !host) return "/";
  try {
    const url = new URL(referer);
    const path = `${url.pathname}${url.search}`;
    if (url.host !== host || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
    return path;
  } catch {
    return "/";
  }
}
