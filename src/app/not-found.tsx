import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AREAS } from "@/lib/areas";

export const metadata: Metadata = { title: "Página não encontrada" };

/** 404 da aplicação inteira: URLs sem rota e chamadas a `notFound()`. */
export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Página não encontrada"
        description="O endereço acessado não existe nesta central. Escolha uma das áreas abaixo."
      />
      <nav aria-labelledby="areas-404">
        <h2 id="areas-404" className="sr-only">
          Áreas da central
        </h2>
        <ul className="space-y-2">
          <li>
            <Link href="/" className="font-semibold text-[var(--lia-blue)] underline">
              Início
            </Link>
          </li>
          {AREAS.map((area) => (
            <li key={area.href}>
              <Link href={area.href} className="text-[var(--lia-blue)] underline">
                {area.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
