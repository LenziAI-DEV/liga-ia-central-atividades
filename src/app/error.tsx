"use client";

import Link from "next/link";

/** Falha inesperada ao montar uma tela: texto claro, nada de detalhe técnico, caminho para tentar de novo. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-md border-l-4 border-[var(--error-ink)] bg-[var(--error-bg)] px-4 py-3 text-[var(--error-ink)]">
      <p>
        <strong>Erro:</strong> não foi possível montar esta tela. Seus dados não foram alterados.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className="rounded-md bg-[var(--primary)] px-4 py-2 font-medium text-[var(--on-primary)] hover:bg-[var(--primary-hover)]">
          Tentar de novo
        </button>
        <Link href="/" className="underline underline-offset-2">
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
