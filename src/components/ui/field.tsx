import type { ReactNode } from "react";

/** Aparência única de campos de formulário (input, select e textarea). */
export const CONTROL =
  "w-full min-h-10 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]";

/** Rótulo visível + dica opcional acima do controle (o controle é filho, dentro do <label>). */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-[var(--text)]">{label}</span>
      {hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
      {children}
    </label>
  );
}
