"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveActivityAction, type FormState } from "@/app/atividades/actions";
import { ACTIVITY_STATUS } from "@/lib/labels";
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

const INPUT = "w-full rounded border border-[var(--line)] bg-[var(--paper)] px-3 py-2";

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

  const field = (name: FieldName, label: string, control: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode) => {
    const id = `campo-${name}`;
    const error = state.errors[name];
    return (
      <div className="grid gap-1">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {control({ id, describedBy: error ? `${id}-erro` : undefined, invalid: Boolean(error) })}
        {error ? (
          <p id={`${id}-erro`} className="text-sm font-medium text-[var(--danger-ink)]">
            Erro: {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form action={formAction} className="grid max-w-2xl gap-5" noValidate>
      {editing ? (
        <>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="version" value={initial.version} />
        </>
      ) : null}

      {state.message ? (
        <div role="alert" className="rounded border-l-4 border-[var(--danger-ink)] bg-[var(--danger-bg)] px-4 py-3 text-[var(--danger-ink)]">
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

      {field("title", "Título (obrigatório)", ({ id, describedBy, invalid }) => (
        <input id={id} name="title" defaultValue={value("title")} aria-describedby={describedBy} aria-invalid={invalid} aria-required="true" className={INPUT} />
      ))}
      {field("description", "Descrição breve", ({ id, describedBy, invalid }) => (
        <textarea id={id} name="description" defaultValue={value("description")} rows={3} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("front", "Frente", ({ id, describedBy, invalid }) => (
        <>
          <input id={id} name="front" list="frentes" defaultValue={value("front")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
          <datalist id="frentes">
            {fronts.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </>
      ))}
      <fieldset id="campo-ownerIds" className="grid gap-1" aria-describedby={state.errors.ownerIds ? "campo-ownerIds-erro" : undefined}>
        <legend className="font-medium">Responsáveis</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input type="checkbox" name="ownerIds" value={m.id} defaultChecked={selectedOwners.includes(m.id)} />
              {m.name} ({m.front})
            </label>
          ))}
        </div>
        {initial.unresolvedOwners && initial.unresolvedOwners.length > 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            Também consta como responsável a confirmar: {initial.unresolvedOwners.join("; ")} (mantido).
          </p>
        ) : null}
        {state.errors.ownerIds ? <p id="campo-ownerIds-erro" className="text-sm font-medium text-[var(--danger-ink)]">Erro: {state.errors.ownerIds}</p> : null}
      </fieldset>
      {field("nextStep", "Próximo passo", ({ id, describedBy, invalid }) => (
        <input id={id} name="nextStep" defaultValue={value("nextStep")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("status", "Estado", ({ id, describedBy, invalid }) => (
        <select id={id} name="status" defaultValue={initial.values.status === "" ? value("status") : value("status") || "a_fazer"} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT}>
          {initial.values.status === "" ? <option value="">Estado a confirmar (escolha um)</option> : null}
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {ACTIVITY_STATUS[s].label}
            </option>
          ))}
        </select>
      ))}
      {field("dueDate", "Prazo (opcional; em branco = a definir)", ({ id, describedBy, invalid }) => (
        <input id={id} name="dueDate" type="date" defaultValue={value("dueDate")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("priority", "Prioridade", ({ id, describedBy, invalid }) => (
        <input id={id} name="priority" defaultValue={value("priority")} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {field("notes", "Notas e bloqueios", ({ id, describedBy, invalid }) => (
        <textarea id={id} name="notes" defaultValue={value("notes")} rows={3} aria-describedby={describedBy} aria-invalid={invalid} className={INPUT} />
      ))}
      {editing ? (
        <div className="grid gap-1">
          <label htmlFor="campo-reason" className="font-medium">
            Motivo da alteração (opcional)
          </label>
          <input id="campo-reason" name="reason" maxLength={2000} defaultValue={value("reason")} className={INPUT} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded bg-[var(--lia-blue)] px-5 py-2 font-medium text-[var(--paper)] hover:bg-[var(--lia-blue-dark)] disabled:opacity-60"
        >
          {pending ? "Salvando…" : editing ? "Salvar alterações" : "Criar atividade"}
        </button>
        <Link href={cancelHref} className="text-[var(--lia-blue)] underline underline-offset-2">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
