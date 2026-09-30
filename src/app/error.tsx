"use client";

import Link from "next/link";

/** Falha inesperada ao montar uma tela: texto claro, nada de detalhe técnico, caminho para tentar de novo. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded border-l-4 border-[var(--danger-ink)] bg-[var(--danger-bg)] px-4 py-3 text-[var(--danger-ink)]">
      <p>
        <strong>Erro:</strong> não foi possível montar esta tela. Seus dados não foram alterados.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-4">
        <button type="button" onClick={reset} className="rounded bg-[var(--lia-blue)] px-4 py-2 font-medium text-[var(--paper)] hover:bg-[var(--lia-blue-dark)]">
          Tentar de novo
        </button>
        <Link href="/" className="underline underline-offset-2">
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
