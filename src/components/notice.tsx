import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

const STYLES: Record<Tone, string> = {
  ok: "border-[var(--ok-ink)] bg-[var(--ok-bg)] text-[var(--ok-ink)]",
  warn: "border-[var(--warn-ink)] bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  danger: "border-[var(--danger-ink)] bg-[var(--danger-bg)] text-[var(--danger-ink)]",
  info: "border-[var(--lia-blue)] bg-[var(--lia-cyan-soft)] text-[var(--ink)]",
  neutral: "border-[var(--line)] bg-[var(--paper-alt)] text-[var(--ink)]",
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
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded border-l-4 px-4 py-3 ${STYLES[tone]}`}
    >
      <p>
        <strong className="font-semibold">{title ?? PREFIX[tone]}</strong> {children}
      </p>
    </div>
  );
}
