"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { decideHost } from "@/lib/host-policy";
import { revokeConnection } from "@/server/auth/google-oauth";
import { getEnv } from "@/server/config/env";
import { requestSync } from "@/server/container";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";

/**
 * Server Actions só aceitam o host canônico (além do `proxy.ts`): a documentação
 * do Next pede a verificação dentro de cada ação, e não só no proxy.
 */
async function assertLocalRequest() {
  const host = (await headers()).get("host");
  if (decideHost({ host, baseUrl: getEnv().APP_BASE_URL, method: "POST", path: "/" }).action !== "allow") {
    throw new AppError("host_not_allowed", "Requisição recusada: abra o app pelo endereço configurado em APP_BASE_URL.");
  }
}

/** "Sincronizar agora": mesmo serviço do ciclo automático (F1.4). */
export async function syncNowAction() {
  await assertLocalRequest();
  const outcome = await requestSync("manual");
  redirect(`/sincronizacao?sync=${outcome.status}`);
}

/** Revoga o acesso no Google e apaga os tokens locais; fontes e atividades ficam ([GUIA §12]). */
export async function disconnectAction() {
  await assertLocalRequest();
  const { revoked } = await revokeConnection(getDb(), getEnv());
  redirect(`/sincronizacao?desconectado=${revoked ? "1" : "local"}`);
}
