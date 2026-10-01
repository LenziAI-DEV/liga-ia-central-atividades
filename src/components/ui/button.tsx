import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT = {
  primary: "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
  danger:
    "border border-[var(--error-ink)] bg-[var(--surface)] text-[var(--error-ink)] hover:bg-[var(--error-bg)]",
  ghost: "text-[var(--primary)] hover:bg-[var(--primary-soft)]",
} as const;

const SIZE = {
  sm: "min-h-8 px-3 text-sm",
  md: "min-h-10 px-4 text-sm",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/** Classes de botão, para usar também em links que parecem botão. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...rest} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...rest} />;
}
