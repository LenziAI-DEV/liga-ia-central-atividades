/**
 * Política de host da aplicação local (proteção contra acesso pela rede e DNS
 * rebinding; host canônico para o cookie do OAuth — RK-01).
 * - host canônico (o de `APP_BASE_URL`): passa;
 * - apelido de loopback na mesma porta (`127.0.0.1`, `[::1]`): GET/HEAD vão para o
 *   host canônico; o resto é recusado;
 * - qualquer outro host (IP da rede, domínio de terceiros, Host ausente): recusado.
 * Função pura: usada pelo `proxy.ts` e pelas Server Actions.
 */

export type HostDecision = { action: "allow" } | { action: "redirect"; location: string } | { action: "reject" };

const LOOPBACK_ALIASES = new Set(["127.0.0.1", "[::1]"]);

export function decideHost(input: {
  host: string | null | undefined;
  baseUrl: string;
  method: string;
  path: string;
}): HostDecision {
  const base = new URL(input.baseUrl);
  const host = (input.host ?? "").trim().toLowerCase();
  if (!host) return { action: "reject" };
  if (host === base.host.toLowerCase()) return { action: "allow" };

  const port = base.port || (base.protocol === "https:" ? "443" : "80");
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(host);
  const safeMethod = input.method === "GET" || input.method === "HEAD";
  if (match && LOOPBACK_ALIASES.has(match[1]) && (match[2] ?? "80") === port && safeMethod) {
    return { action: "redirect", location: new URL(input.path, base).toString() };
  }
  return { action: "reject" };
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/**
 * Leva o navegador ao host canônico. Não usa `Location`: o Next trata `127.0.0.1`,
 * `[::1]` e `localhost` como o mesmo host e reescreve o redirecionamento como
 * relativo (`server/web/adapter.js`), o que manteria o navegador em `127.0.0.1`.
 */
export function canonicalHostResponse(location: string): Response {
  const href = escapeHtml(location);
  const html =
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<meta http-equiv="refresh" content="0;url=${href}"><title>Redirecionando…</title></head>` +
    `<body><p>Este app funciona em <a href="${href}">${href}</a>. Redirecionando…</p></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
