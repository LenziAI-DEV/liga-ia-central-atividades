/** Estado provisório das áreas ainda não implementadas (removido na fase indicada). */
export function AreaPlaceholder({ phase }: { phase: string }) {
  return (
    <section
      aria-labelledby="em-construcao"
      className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6"
    >
      <h2 id="em-construcao" className="font-semibold text-[var(--text)]">
        Em construção
      </h2>
      <p className="mt-1 text-[var(--text-muted)]">Esta área será entregue na {phase} do plano de implementação.</p>
    </section>
  );
}
