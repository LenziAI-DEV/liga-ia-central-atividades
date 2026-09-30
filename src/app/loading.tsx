/** Carregando: mensagem própria em texto, anunciada a leitores de tela (CA-F12.5). */
export default function Loading() {
  return (
    <p role="status" className="rounded border border-[var(--line)] bg-[var(--paper-alt)] px-4 py-3">
      <strong>Carregando:</strong> buscando os dados no banco local…
    </p>
  );
}
