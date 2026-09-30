import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

const TONES: Record<Tone, { className: string; icon: string }> = {
  ok: { className: "bg-[var(--ok-bg)] text-[var(--ok-ink)]", icon: "✓" },
  warn: { className: "bg-[var(--warn-bg)] text-[var(--warn-ink)]", icon: "!" },
  danger: { className: "bg-[var(--danger-bg)] text-[var(--danger-ink)]", icon: "✕" },
  info: { className: "bg-[var(--lia-cyan-soft)] text-[var(--ink)]", icon: "↻" },
  neutral: { className: "bg-[var(--paper-alt)] text-[var(--ink-muted)]", icon: "•" },
};

/** Estado sempre com texto; o ícone é decorativo (R11: não depender só de cor). */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { className, icon } = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-sm font-medium ${className}`}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}
