import { Notice } from "@/components/notice";
import type { RegistryResolution } from "@/server/authority/registry-locator";

/** Qual planilha é a fonte das atividades e quem a apontou; sem certeza, pendência visível (F4.5). */
export function RegistryStatus({ resolution }: { resolution: RegistryResolution }) {
  return (
    <section aria-labelledby="registro" className="mt-8">
      <h2 id="registro" className="text-xl font-semibold">
        Fonte das atividades
      </h2>
      <div className="mt-3">
        {resolution.status === "ok" ? (
          <p>
            <strong>{resolution.source.name}</strong>, aba <strong>{resolution.sheet.name}</strong>, apontada pelo
            índice <strong>{resolution.index.name}</strong>. Só o arquivo apontado pelo índice vale como registro; planilhas
            parecidas ou mais recentes não alteram atividades.
          </p>
        ) : (
          <Notice tone="warn" title="Fonte oficial não identificada:">
            {resolution.reason} Nenhuma atividade foi importada.
          </Notice>
        )}
      </div>
    </section>
  );
}
