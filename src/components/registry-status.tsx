import Link from "next/link";
import { Notice } from "@/components/notice";
import type { ImportReport } from "@/server/activities/import-hook";
import type { RegistryResolution } from "@/server/authority/registry-locator";

/** Qual planilha é a fonte das atividades e quem a apontou; sem certeza, pendência visível (F4.5). */
export function RegistryStatus({
  resolution,
  report,
}: {
  resolution: RegistryResolution;
  report: ImportReport | undefined;
}) {
  return (
    <section aria-labelledby="registro" className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 id="registro" className="text-base font-semibold">
        Fonte das atividades
      </h2>
      <div className="mt-3 space-y-3">
        {resolution.status === "ok" ? (
          <p>
            <strong>{resolution.source.name}</strong>, aba <strong>{resolution.sheet.name}</strong>, apontada pelo
            índice <strong>{resolution.index.name}</strong>. Só o arquivo apontado pelo índice vale como registro;
            planilhas parecidas ou mais recentes não alteram atividades.
          </p>
        ) : (
          <Notice tone="warn" title="Fonte oficial não identificada:">
            {resolution.reason} Nenhuma atividade foi importada.{" "}
            <Link href="/como-decidimos" className="underline">
              Como o app decide
            </Link>
          </Notice>
        )}
        {resolution.status === "ok" && report?.state === "pending" ? (
          <Notice tone="warn" title="Importação pendente:">
            {report.message} Nenhuma atividade foi importada; a próxima sincronização tenta de novo.
          </Notice>
        ) : null}
        {report?.state === "error" ? (
          <Notice tone="danger">{report.message}</Notice>
        ) : null}
        {report && report.issues.length > 0 ? (
          <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <summary className="cursor-pointer font-medium">
              {report.issues.length} linha(s) do registro com problema ou ajuste
            </summary>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {report.issues.map((issue, i) => (
                <li key={`${issue.row}-${i}`}>
                  Linha {issue.row}
                  {issue.id ? ` (${issue.id})` : ""}: {issue.message}.
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
