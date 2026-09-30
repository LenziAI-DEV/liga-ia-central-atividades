import { NextResponse, type NextRequest } from "next/server";
import { canonicalHostResponse, decideHost } from "@/lib/host-policy";

/**
 * Só o host de `APP_BASE_URL` é atendido (docs: file-conventions/proxy).
 * - `127.0.0.1` → redireciona para `localhost` (o cookie do OAuth depende disso);
 * - IP da rede ou outro domínio (DNS rebinding) → 403.
 * As Server Actions repetem a verificação (ver `sincronizacao/actions.ts`).
 */
export function proxy(request: NextRequest) {
  const decision = decideHost({
    host: request.headers.get("host"),
    baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    method: request.method,
    path: `${request.nextUrl.pathname}${request.nextUrl.search}`,
  });
  if (decision.action === "allow") return NextResponse.next();
  if (decision.action === "redirect") return canonicalHostResponse(decision.location);
  return new NextResponse(
    "Endereço não permitido. Abra o app pelo endereço configurado em APP_BASE_URL (padrão: http://localhost:3000).",
    { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
