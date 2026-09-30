"use server";

import { redirect } from "next/navigation";
import { systemClock } from "@/lib/datetime";
import { retryAnalysis } from "@/server/ai/analysis-service";
import { reviewSuggestion, type ReviewAction } from "@/server/ai/suggestion-service";
import { getDb } from "@/server/db";
import { logger } from "@/server/observability/logger";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";
import { assertLocalRequest } from "@/server/security/assert-local-request";

export interface ReviewState {
  message: string | null;
  errors: Record<string, string>;
}

const ACTIONS: readonly ReviewAction[] = ["accept", "adjust", "reject"];
const ADJUSTABLE = ["title", "dueDate", "nextStep", "front", "status"] as const;

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

/** Decide uma sugestão. O papel é conferido no servidor; o resultado vira redirecionamento (PRG). */
export async function reviewAction(_previous: ReviewState, data: FormData): Promise<ReviewState> {
  try {
    await assertLocalRequest();
    const id = Number(text(data, "id"));
    const action = ACTIONS.find((a) => a === text(data, "action"));
    if (!Number.isInteger(id) || !action) return { message: "Pedido inválido. Nada foi alterado.", errors: {} };

    const adjusted: Record<string, unknown> = {};
    if (action === "adjust") {
      for (const key of ADJUSTABLE) if (data.has(`has_${key}`)) adjusted[key] = text(data, `adj_${key}`);
      if (data.has("has_ownerIds")) adjusted.ownerIds = data.getAll("adj_ownerIds").filter((v): v is string => typeof v === "string");
    }
    const persona = await getCurrentPersona();
    const outcome = reviewSuggestion(
      getDb(),
      { id, action, reviewer: persona, adjusted, reason: text(data, "reason").slice(0, 2000) },
      listMembers(),
      systemClock,
    );
    if (!outcome.ok) return { message: outcome.message, errors: outcome.errors ?? {} };
    if (outcome.activityId && action !== "reject") redirect(`/atividades/${encodeURIComponent(outcome.activityId)}?aviso=${outcome.changed ? "salva" : "semmudanca"}`);
    redirect(`/sugestoes?aviso=${outcome.status}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    logger.error("suggestion.review_failed", { error });
    return { message: "Não foi possível registrar a decisão. Nada foi alterado.", errors: {} };
  }
}

/** "Tentar novamente" uma análise por IA que falhou ou ficou pendente (F7.10). */
export async function retryAnalysisAction(data: FormData) {
  await assertLocalRequest();
  const id = Number(text(data, "id"));
  if (Number.isInteger(id)) retryAnalysis(getDb(), id);
  redirect("/sugestoes?aviso=reanalise");
}
