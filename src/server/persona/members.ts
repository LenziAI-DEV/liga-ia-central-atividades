import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AppError } from "@/server/errors";

export interface Member {
  id: string;
  name: string;
  aliases: string[];
  front: string;
  role: "member" | "leader";
  canReview: boolean;
}

const MemberSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,30}$/),
  name: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().trim().min(1).max(80)).default([]),
  front: z.string().trim().min(1).max(80),
  role: z.enum(["member", "leader"]),
  canReview: z.boolean(),
});

const FileSchema = z.object({ members: z.array(MemberSchema) });

/** Chave de comparação de nomes: sem acento, sem caixa, espaços colapsados. */
export function nameKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function invalid(message: string): never {
  throw new AppError("members_invalid", `config/members.json inválido: ${message}`);
}

export function parseMembers(raw: unknown): Member[] {
  const parsed = FileSchema.safeParse(raw);
  if (!parsed.success) invalid(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { members } = parsed.data;
  if (members.length < 2) invalid("são necessários ao menos dois membros.");
  if (!members.some((m) => m.canReview)) invalid("é necessário ao menos um revisor.");
  const ids = new Set<string>();
  const names = new Map<string, string>();
  for (const member of members) {
    if (ids.has(member.id)) invalid(`id repetido: ${member.id}.`);
    ids.add(member.id);
    for (const label of [member.name, ...member.aliases]) {
      const key = nameKey(label);
      const owner = names.get(key);
      if (owner !== undefined && owner !== member.id) invalid(`nome ou apelido ambíguo: "${label}".`);
      names.set(key, member.id);
    }
  }
  return members;
}

export function loadMembers(): Member[] {
  const path = join(/* turbopackIgnore: true */ process.cwd(), "config", "members.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (cause) {
    throw new AppError("members_missing", "Não foi possível ler config/members.json.", { cause });
  }
  try {
    return parseMembers(JSON.parse(text));
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError("members_invalid", "config/members.json não é um JSON válido.", { cause });
  }
}

export function findMember(members: readonly Member[], id: string | undefined | null): Member | null {
  if (!id) return null;
  return members.find((m) => m.id === id) ?? null;
}

/** Responsável escrito na planilha → membro, por nome ou apelido; sem correspondência → null (a confirmar). */
export function matchMemberByName(members: readonly Member[], text: string): Member | null {
  const key = nameKey(text);
  if (!key) return null;
  return members.find((m) => [m.name, ...m.aliases].some((label) => nameKey(label) === key)) ?? null;
}
