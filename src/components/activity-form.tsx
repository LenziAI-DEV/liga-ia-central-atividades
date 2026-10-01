"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveActivityAction, type FormState } from "@/app/atividades/actions";
import { ACTIVITY_STATUS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { CONTROL } from "@/components/ui/field";
import { STATUS_VALUES, type FieldName } from "@/server/activities/activity-input";

export interface FormMember {
  id: string;
  name: string;
  front: string;
}

export interface FormInitial {
  id?: string;
  version?: number;
  values: Record<string, string | string[]>;
  /** Responsáveis "a confirmar" preservados na edição (só leitura). */
  unresolvedOwners?: string[];
}

const INPUT = CONTROL;
const WIDE = "md:col-span-2";

/** Formulário de criação e edição: rótulos visíveis e erro em texto ligado ao campo (F6.9, CA-F6.3). */
export function ActivityForm({
  members,
  fronts,
  initial,
  cancelHref,
}: {
  members: FormMember[];
  fronts: string[];
  initial: FormInitial;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveActivityAction, {
    errors: {},
    message: null,
    values: initial.values,
  });
  const value = (key: string) => {
    const v = state.values[key];
    return typeof v === "string" ? v : "";
  };
  const selectedOwners = Array.isArray(state.values.ownerIds) ? state.values.ownerIds : [];
  const editing = initial.id !== undefined;
  const errorFields = Object.keys(state.errors) as FieldName[];

  const field = (name: FieldName, label: string, wide: boolean, control: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode) => {
    const id = `campo-${name}`;
    const error = state.errors[name];
    return (
      <div className={`grid content-start gap-1 ${wide ? WIDE : ""}`}>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {control({ id, describedBy: error ? `${id}-erro` : undefined, invalid: Boolean(error) })}
        {error ? (
          <p id={`${id}-erro`} className="text-sm font-medium text-[var(--error-ink)]">
            Erro: {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form action={formAction} className="grid max-w-3xl gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-2 md:p-6" noValidate>
      {editing ? (
        <>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="version" value={initial.version} />
        </>
      ) : null}

      {state.message ? (
        <div role="alert" className={`rounded-md border-l-4 border-[var(--error-ink)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error-ink)] ${WIDE}`}>
          <p>
            <strong>Erro:</strong> {state.message}
          </p>
          {errorFields.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {errorFields.map((name) => (
                <li key={name}>
                  <a href={`#campo-${name}`} className="underline">
                    {state.errors[name]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {field("title", "Título (obrigatório)", true, ({ id, describedBy, invalid }) => (
        <input id={id} name="title" defaultValue={value("title")} aria-describedby={describedBy} aria-invalid={invalid} aria-required="true" className={INPUT} />
      ))}
      {field("description", "Descrição breve", true, ({ id, describedBy, invalid }) => (
        <textarea id={id} name="description" defaultValue={value("description")} rows={3} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("front", "Frente", false, ({ id, describedBy, invalid }) => (
        <>
          <input id={id} name="front" list="frentes" defaultValue={value("front")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
          <datalist id="frentes">
            {fronts.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </>
      ))}
      <fieldset id="campo-ownerIds" className={`grid gap-1 ${WIDE}`} aria-describedby={state.errors.ownerIds ? "campo-ownerIds-erro" : undefined}>
        <legend className="text-sm font-medium">Responsáveis</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input type="checkbox" name="ownerIds" value={m.id} defaultChecked={selectedOwners.includes(m.id)} />
              {m.name} ({m.front})
            </label>
          ))}
        </div>
        {initial.unresolvedOwners && initial.unresolvedOwners.length > 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Também consta como responsável a confirmar: {initial.unresolvedOwners.join("; ")} (mantido).
          </p>
        ) : null}
        {state.errors.ownerIds ? <p id="campo-ownerIds-erro" className="text-sm font-medium text-[var(--error-ink)]">Erro: {state.errors.ownerIds}</p> : null}
      </fieldset>
      {field("nextStep", "Próximo passo", true, ({ id, describedBy, invalid }) => (
        <input id={id} name="nextStep" defaultValue={value("nextStep")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("status", "Estado", false, ({ id, describedBy, invalid }) => (
        <select id={id} name="status" defaultValue={initial.values.status === "" ? value("status") : value("status") || "a_fazer"} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT}>
          {initial.values.status === "" ? <option value="">Estado a confirmar (escolha um)</option> : null}
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {ACTIVITY_STATUS[s].label}
            </option>
          ))}
        </select>
      ))}
      {field("dueDate", "Prazo (opcional; em branco = a definir)", false, ({ id, describedBy, invalid }) => (
        <input id={id} name="dueDate" type="date" defaultValue={value("dueDate")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("priority", "Prioridade", false, ({ id, describedBy, invalid }) => (
        <input id={id} name="priority" defaultValue={value("priority")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("notes", "Notas e bloqueios", true, ({ id, describedBy, invalid }) => (
        <textarea id={id} name="notes" defaultValue={value("notes")} rows={3} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {editing ? (
        <div className={`grid gap-1 ${WIDE}`}>
          <label htmlFor="campo-reason" className="text-sm font-medium">
            Motivo da alteração (opcional)
          </label>
          <input id="campo-reason" name="reason" maxLength={2000} defaultValue={value("reason")} className={INPUT} />
        </div>
      ) : null}

      <div className={`flex flex-wrap items-center gap-4 ${WIDE}`}>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : editing ? "Salvar alterações" : "Criar atividade"}
        </Button>
        <Link href={cancelHref} className="text-[var(--primary)] underline underline-offset-2">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
