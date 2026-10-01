"use client";

import { useActionState } from "react";
import { reviewAction, type ReviewState } from "@/app/sugestoes/actions";
import { ACTIVITY_STATUS } from "@/lib/labels";

export interface ReviewField {
  key: "title" | "dueDate" | "nextStep" | "front" | "status" | "ownerIds";
  label: string;
  proposed: string | string[];
}

const INPUT = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2";

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
  return (
    <form action={formAction} className="grid max-w-2xl gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      {state.message ? (
        <div role="alert" className="rounded-md border-l-4 border-[var(--error-ink)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-ink)]">
          <p>
            <strong>Erro:</strong> {state.message}
          </p>
          {Object.values(state.errors).length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(state.errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <fieldset className="grid gap-3 rounded-md border border-[var(--border)] p-4">
        <legend className="px-1 font-medium">Valores a aplicar (você pode ajustar)</legend>
        {fields.map((f) => {
          const inputId = `adj-${f.key}`;
          return (
            <div key={f.key} className="grid gap-1">
              <input type="hidden" name={`has_${f.key}`} value="1" />
              {f.key === "ownerIds" ? (
                <fieldset className="grid gap-1">
                  <legend className="text-sm font-medium">{f.label}</legend>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
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
                    <select id={inputId} name={`adj_${f.key}`} defaultValue={f.proposed as string} className={INPUT}>
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
                      className={INPUT}
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
        <p className="text-sm text-[var(--text-muted)]">Apagar um valor significa não aplicar aquele campo.</p>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="action"
          value="accept"
          disabled={pending}
          className="rounded-md bg-[var(--primary)] px-5 py-2 font-medium text-[var(--on-primary)] hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          Aceitar como proposto
        </button>
        <button
          type="submit"
          name="action"
          value="adjust"
          disabled={pending}
          className="rounded-md border border-[var(--primary)] px-5 py-2 font-medium text-[var(--primary)] disabled:opacity-60"
        >
          Ajustar e aceitar
        </button>
      </div>

      <div className="grid gap-2 rounded-md border border-[var(--border)] p-4">
        <label htmlFor="reason" className="text-sm font-medium">
          Motivo da rejeição (obrigatório para rejeitar)
        </label>
        <input id="reason" name="reason" maxLength={2000} className={INPUT} />
        <div>
          <button
            type="submit"
            name="action"
            value="reject"
            disabled={pending}
            className="rounded-md border border-[var(--error-ink)] px-5 py-2 font-medium text-[var(--error-ink)] disabled:opacity-60"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </form>
  );
}
