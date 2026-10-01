import type { ReactNode } from "react";

/** Vazio com contexto: o que falta e, quando houver, o que fazer (sem "(0)" nem caixa em branco). */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-8 text-center">
      <p className="font-medium text-[var(--text)]">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--text-muted)]">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
