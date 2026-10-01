"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/button";

/** Botão de formulário que mostra o andamento enquanto a Server Action roda. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
