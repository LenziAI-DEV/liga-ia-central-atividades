import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

const TONES: Record<Tone, string> = {
  ok: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  warn: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  danger: "bg-[var(--error-bg)] text-[var(--error-ink)]",
  info: "bg-[var(--primary-soft)] text-[var(--primary)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
};

/** Estado sempre em texto (R11: não depender só de cor); sem ícone decorativo. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
