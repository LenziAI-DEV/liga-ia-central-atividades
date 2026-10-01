import { switchPersonaAction } from "@/app/persona/actions";
import { ROLE_LABEL } from "@/lib/labels";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";
import { Button } from "@/components/ui/button";

const SELECT =
  "min-h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm";

/** Persona ativa sempre em texto, com troca por formulário nativo (teclado, sem JS; CA-F11.1). */
export async function PersonaSwitcher() {
  const [current, members] = [await getCurrentPersona(), listMembers()];
  return (
    <section aria-label="Persona ativa" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <p className="leading-tight">
        {current ? (
          <>
            Persona ativa: <strong>{current.name}</strong>
            <span className="block text-xs text-[var(--text-muted)]">
              {current.front} · {ROLE_LABEL[current.role]}
              {current.canReview ? " · revisor(a) de sugestões" : ""}
            </span>
          </>
        ) : (
          <strong>Nenhuma persona escolhida: escolha uma para ver o que é seu.</strong>
        )}
      </p>
      <form action={switchPersonaAction} className="flex items-center gap-2">
        <label htmlFor="persona-select" className="text-[var(--text-muted)]">
          Trocar para
        </label>
        <select id="persona-select" name="persona" defaultValue={current?.id ?? ""} className={SELECT}>
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
        <Button type="submit" variant="secondary" size="sm">
          Trocar
        </Button>
      </form>
    </section>
  );
}
