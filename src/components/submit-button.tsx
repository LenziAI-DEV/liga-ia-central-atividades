"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

const VARIANTS = {
  primary:
    "bg-[var(--lia-blue)] text-[var(--paper)] hover:bg-[var(--lia-blue-dark)] disabled:opacity-60",
  secondary:
    "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--lia-blue)] disabled:opacity-60",
} as const;

/** Botão de formulário que mostra o andamento enquanto a Server Action roda. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`inline-flex items-center rounded px-4 py-2 font-medium ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
