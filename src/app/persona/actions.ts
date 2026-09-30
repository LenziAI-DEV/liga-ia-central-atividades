"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PERSONA_COOKIE } from "@/server/persona/current-persona";
import { findMember, loadMembers } from "@/server/persona/members";
import { assertLocalRequest } from "@/server/security/assert-local-request";

/** Volta para a página de onde veio (mesmo host); qualquer outra coisa vai para a raiz. */
async function returnPath(): Promise<string> {
  const h = await headers();
  const referer = h.get("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    return url.host === h.get("host") ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

/**
 * Troca a persona ativa. Só guarda a escolha num cookie: não grava evento nem altera
 * nenhum dado (CA-F5.2). Id desconhecido é ignorado.
 */
export async function switchPersonaAction(formData: FormData) {
  await assertLocalRequest();
  const member = findMember(loadMembers(), String(formData.get("persona") ?? ""));
  if (member) {
    (await cookies()).set(PERSONA_COOKIE, member.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect(await returnPath());
}
