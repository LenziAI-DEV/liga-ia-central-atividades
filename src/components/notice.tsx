import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

const STYLES: Record<Tone, string> = {
  ok: "border-[var(--success-ink)] bg-[var(--success-bg)] text-[var(--success-ink)]",
  warn: "border-[var(--warning-ink)] bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  danger: "border-[var(--error-ink)] bg-[var(--error-bg)] text-[var(--error-ink)]",
  info: "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]",
  neutral: "border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text)]",
};

const PREFIX: Record<Tone, string> = {
  ok: "Pronto:",
  warn: "Atenção:",
  danger: "Erro:",
  info: "Aviso:",
  neutral: "Nota:",
};

/** Mensagem em texto com prefixo explícito; erros são anunciados a leitores de tela. */
export function Notice({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-md border-l-4 px-4 py-3 text-sm ${STYLES[tone]}`}>
      <p>
        <strong className="font-semibold">{title ?? PREFIX[tone]}</strong> {children}
      </p>
    </div>
  );
}
