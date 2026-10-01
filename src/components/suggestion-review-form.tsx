"use client";

import { useActionState } from "react";
import { reviewAction, type ReviewState } from "@/app/sugestoes/actions";
import { Button } from "@/components/ui/button";
import { CONTROL } from "@/components/ui/field";
import { ACTIVITY_STATUS } from "@/lib/labels";

export interface ReviewField {
  key: "title" | "dueDate" | "nextStep" | "front" | "status" | "ownerIds";
  label: string;
  proposed: string | string[];
}

/** Aceitar, ajustar e aceitar, ou rejeitar com motivo. Erros em texto, ligados ao campo (F8.2, F8.9, CA-F8.5). */
export function SuggestionReviewForm({
  id,
  fields,
  members,
}: {
  id: number;
  fields: ReviewField[];
  members: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(reviewAction, { message: null, errors: {} });
  const hasFieldErrors = Object.keys(state.errors).length > 0;
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      {state.message ? (
        <div role="alert" className="rounded-md border-l-4 border-[var(--error-ink)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-ink)]">
          <p>
            <strong>Erro:</strong> {state.message}
          </p>
          {hasFieldErrors ? (
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(state.errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2">
        <Button type="submit" name="action" value="accept" disabled={pending}>
          Aceitar como proposto
        </Button>
        <p className="text-xs text-[var(--text-muted)]">Aplica os valores propostos à atividade e registra você como revisor.</p>
      </div>

      <details open={hasFieldErrors} className="rounded-md border border-[var(--border)]">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Ajustar valores antes de aceitar</summary>
        <div className="grid gap-3 border-t border-[var(--border)] p-3">
          {fields.map((f) => {
            const inputId = `adj-${f.key}`;
            return (
              <div key={f.key} className="grid gap-1">
                <input type="hidden" name={`has_${f.key}`} value="1" />
                {f.key === "ownerIds" ? (
                  <fieldset className="grid gap-1">
                    <legend className="text-sm font-medium">{f.label}</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                      {members.map((m) => (
                        <label key={m.id} className="flex items-center gap-2">
                          <input type="checkbox" name="adj_ownerIds" value={m.id} defaultChecked={(f.proposed as string[]).includes(m.id)} />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <>
                    <label htmlFor={inputId} className="text-sm font-medium">
                      {f.label}
                    </label>
                    {f.key === "status" ? (
                      <select id={inputId} name={`adj_${f.key}`} defaultValue={f.proposed as string} className={CONTROL}>
                        {(["a_fazer", "em_andamento", "bloqueada", "concluida"] as const).map((s) => (
                          <option key={s} value={s}>
                            {ACTIVITY_STATUS[s].label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={inputId}
                        name={`adj_${f.key}`}
                        type={f.key === "dueDate" ? "date" : "text"}
                        defaultValue={f.proposed as string}
                        aria-describedby={state.errors[f.key] ? `${inputId}-erro` : undefined}
                        aria-invalid={Boolean(state.errors[f.key])}
                        className={CONTROL}
                      />
                    )}
                  </>
                )}
                {state.errors[f.key] ? (
                  <p id={`${inputId}-erro`} className="text-sm font-medium text-[var(--error-ink)]">
                    Erro: {state.errors[f.key]}
                  </p>
                ) : null}
              </div>
            );
          })}
          <p className="text-xs text-[var(--text-muted)]">Apagar um valor significa não aplicar aquele campo.</p>
          <Button type="submit" name="action" value="adjust" variant="secondary" disabled={pending}>
            Ajustar e aceitar
          </Button>
        </div>
      </details>

      <div className="grid gap-2 border-t border-[var(--border)] pt-4">
        <label htmlFor="reason" className="text-sm font-medium">
          Motivo da rejeição <span className="font-normal text-[var(--text-muted)]">(obrigatório para rejeitar)</span>
        </label>
        <input id="reason" name="reason" maxLength={2000} className={CONTROL} />
        <Button type="submit" name="action" value="reject" variant="danger" disabled={pending}>
          Rejeitar
        </Button>
      </div>
    </form>
  );
}
