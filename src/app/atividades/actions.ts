"use server";

import { redirect } from "next/navigation";
import { systemClock } from "@/lib/datetime";
import { parseActivityForm, STATUS_VALUES, type ActivityFields, type FieldErrors } from "@/server/activities/activity-input";
import { createActivity, updateActivity } from "@/server/activities/activity-service";
import { getDb } from "@/server/db";
import { AppError, toSafeMessage } from "@/server/errors";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";
import { assertLocalRequest } from "@/server/security/assert-local-request";
import { logger } from "@/server/observability/logger";

export interface FormState {
  errors: FieldErrors;
  message: string | null;
  /** Valores digitados, para reexibir o formulário sem perder nada. */
  values: Record<string, string | string[]>;
}

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

function formValues(data: FormData): FormState["values"] {
  const values: FormState["values"] = {};
  for (const key of ["title", "description", "nextStep", "front", "status", "dueDate", "priority", "notes", "reason"]) {
    values[key] = text(data, key);
  }
  values.ownerIds = data.getAll("ownerIds").filter((v): v is string => typeof v === "string");
  return values;
}

/** Cria (sem `id`) ou edita (com `id` e `version`) uma atividade, e volta para o detalhe (PRG). */
export async function saveActivityAction(_previous: FormState, data: FormData): Promise<FormState> {
  const values = formValues(data);
  try {
    await assertLocalRequest();
    const persona = await getCurrentPersona();
    if (!persona) {
      return { errors: {}, message: "Escolha uma persona no topo da página antes de salvar.", values };
    }
    const members = listMembers();
    const parsed = parseActivityForm(Object.fromEntries(data), members, data.getAll("ownerIds"));
    if (!parsed.ok) {
      return { errors: parsed.errors, message: "Corrija os campos indicados. Nada foi salvo.", values };
    }
    const id = text(data, "id");
    if (!id) {
      const created = createActivity(getDb(), parsed.value, persona.id, members, systemClock);
      redirect(`/atividades/${encodeURIComponent(created.id)}?aviso=criada`);
    }
    const version = Number(text(data, "version"));
    if (!Number.isInteger(version) || version < 1) {
      return { errors: {}, message: "Não foi possível saber qual versão você editou. Abra a atividade de novo.", values };
    }
    const result = updateActivity(
      getDb(),
      id,
      parsed.value,
      version,
      persona.id,
      members,
      systemClock,
      text(data, "reason").trim().slice(0, 2000),
    );
    redirect(`/atividades/${encodeURIComponent(id)}?aviso=${result.changed ? "salva" : "semmudanca"}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (!(error instanceof AppError)) logger.error("activity.save.failed", { error });
    return { errors: {}, message: toSafeMessage(error), values };
  }
}

/** Ações rápidas do detalhe: concluir, bloquear (com motivo), reabrir. */
export async function quickStatusAction(data: FormData) {
  await assertLocalRequest();
  const id = text(data, "id");
  const target = STATUS_VALUES.find((s) => s === text(data, "status"));
  const version = Number(text(data, "version"));
  const persona = await getCurrentPersona();
  const back = `/atividades/${encodeURIComponent(id)}`;
  if (!persona) redirect(`${back}?aviso=persona`);
  if (!target || !Number.isInteger(version)) redirect(`${back}?aviso=invalido`);
  const reason = text(data, "reason").trim().slice(0, 2000);
  const patch: Partial<ActivityFields> = { status: target };
  if (target === "bloqueada" && reason) patch.notes = reason;
  try {
    const result = updateActivity(getDb(), id, patch, version, persona.id, listMembers(), systemClock, reason || null);
    redirect(`${back}?aviso=${result.changed ? "salva" : "semmudanca"}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (!(error instanceof AppError)) logger.error("activity.status.failed", { error });
    redirect(`${back}?aviso=${error instanceof AppError && error.code === "version_conflict" ? "conflito" : "erro"}`);
  }
}

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
