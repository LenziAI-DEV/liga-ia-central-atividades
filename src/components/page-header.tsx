import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-[var(--line)] pb-6">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-[var(--ink)]">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-[var(--ink-muted)]">{description}</p> : null}
      {children}
    </header>
  );
}
