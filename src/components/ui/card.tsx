import type { HTMLAttributes } from "react";

/** Superfície branca com contorno; sem sombra (sombra só em camadas sobrepostas). */
export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] ${className}`} {...rest} />;
}
