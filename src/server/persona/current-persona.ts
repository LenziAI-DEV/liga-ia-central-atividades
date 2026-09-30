import "server-only";
import { cookies } from "next/headers";
import { findMember, loadMembers, type Member } from "./members";

export const PERSONA_COOKIE = "persona";

export function listMembers(): Member[] {
  return loadMembers();
}

/** Persona ativa, ou null quando ainda não foi escolhida (ou o cookie é inválido). Só lê. */
export async function getCurrentPersona(): Promise<Member | null> {
  const id = (await cookies()).get(PERSONA_COOKIE)?.value;
  return findMember(loadMembers(), id);
}
