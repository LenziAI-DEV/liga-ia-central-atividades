"use server";

import { redirect } from "next/navigation";
import { revokeConnection } from "@/server/auth/google-oauth";
import { getEnv } from "@/server/config/env";
import { requestSync } from "@/server/container";
import { getDb } from "@/server/db";
import { assertLocalRequest } from "@/server/security/assert-local-request";

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
