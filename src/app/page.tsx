import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AREAS } from "@/lib/areas";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Central de contexto e atividades"
        description="Duas perguntas guiam esta central: o que preciso fazer agora? E o que mudou desde a última vez que acompanhei a Liga?"
      />
      <section aria-labelledby="areas-titulo">
        <h2 id="areas-titulo" className="sr-only">
          Áreas da central
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((area) => (
            <li key={area.href}>
              <Link
                href={area.href}
                className="block h-full rounded-md border border-[var(--line)] p-5 transition-colors hover:border-[var(--lia-blue)]"
              >
                <span className="block font-semibold text-[var(--lia-blue)]">{area.label}</span>
                <span className="mt-1 block text-sm text-[var(--ink-muted)]">{area.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
