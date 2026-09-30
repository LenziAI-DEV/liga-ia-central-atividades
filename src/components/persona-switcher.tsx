import { switchPersonaAction } from "@/app/persona/actions";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

/** Persona ativa sempre em texto, com troca por formulário nativo (teclado, sem JS; CA-F11.1). */
export async function PersonaSwitcher() {
  const [current, members] = [await getCurrentPersona(), listMembers()];
  return (
    <section aria-label="Persona ativa" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <p>
        {current ? (
          <>
            Persona ativa: <strong>{current.name}</strong> · {current.front} · {ROLE_LABEL[current.role]}
            {current.canReview ? " · revisor(a) de sugestões" : ""}
          </>
        ) : (
          <strong>Nenhuma persona escolhida: escolha uma para ver o que é seu.</strong>
        )}
      </p>
      <form action={switchPersonaAction} className="flex items-center gap-2">
        <label htmlFor="persona-select" className="text-[var(--ink-muted)]">
          Trocar para
        </label>
        <select
          id="persona-select"
          name="persona"
          defaultValue={current?.id ?? ""}
          className="rounded border border-[var(--line)] bg-[var(--paper)] px-2 py-1"
        >
          {current ? null : (
            <option value="" disabled>
              Escolha…
            </option>
          )}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.front})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-[var(--line)] bg-[var(--paper)] px-3 py-1 hover:border-[var(--lia-blue)]"
        >
          Trocar
        </button>
      </form>
    </section>
  );
}
