import "server-only";
import { headers } from "next/headers";
import { decideHost } from "@/lib/host-policy";
import { getEnv } from "@/server/config/env";
import { AppError } from "@/server/errors";

/**
 * Server Actions só aceitam o host canônico (além do `proxy.ts`): a documentação
 * do Next pede a verificação dentro de cada ação, e não só no proxy.
 */
export async function assertLocalRequest() {
  const host = (await headers()).get("host");
  if (decideHost({ host, baseUrl: getEnv().APP_BASE_URL, method: "POST", path: "/" }).action !== "allow") {
    throw new AppError("host_not_allowed", "Requisição recusada: abra o app pelo endereço configurado em APP_BASE_URL.");
  }
}
