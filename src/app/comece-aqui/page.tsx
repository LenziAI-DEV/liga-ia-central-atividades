import type { Metadata } from "next";
import Link from "next/link";
import { DueDate } from "@/components/due-date";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getArea } from "@/lib/areas";
import { formatDateTimeBR, isoDateInSaoPaulo } from "@/lib/datetime";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { getOnboarding, type DocRef, type Snippet } from "@/server/onboarding/onboarding-service";
import { getCurrentPersona, listMembers } from "@/server/persona/current-persona";

const area = getArea("/comece-aqui");
export const metadata: Metadata = { title: area.label };

const link = "text-[var(--lia-blue)] underline underline-offset-2";

function DocLink({ doc }: { doc: DocRef }) {
  return (
    <>
      <Link href={`/fontes/${encodeURIComponent(doc.fileId)}`} className={link}>
        {doc.name}
      </Link>
      {doc.webUrl?.startsWith("https://") ? (
        <>
          {" "}
          (
          <a href={doc.webUrl} className={link}>
            abrir no Drive
          </a>
          )
        </>
      ) : null}
    </>
  );
}

/** Selo de documento provisório, com quem confirma quando o documento diz. */
function Provisional({ doc }: { doc: DocRef }) {
  if (!doc.provisional) return null;
  return (
    <>
      {" "}
      <StatusBadge tone="warn">Provisório / a confirmar</StatusBadge>
      {doc.confirmBy ? <span className="text-sm"> Confirmar com {doc.confirmBy}.</span> : null}
    </>
  );
}

function Quote({ snippet }: { snippet: Snippet }) {
  return (
    <>
      <q>{snippet.text}</q> — <DocLink doc={snippet.doc} />
      <Provisional doc={snippet.doc} />
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`passo-${n}`} className="mb-8">
      <h2 id={`passo-${n}`} className="font-serif text-2xl font-semibold">
        Passo {n} · {title}
      </h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

export default async function Page() {
  const persona = await getCurrentPersona();
  const today = isoDateInSaoPaulo(new Date());
  const view = getOnboarding(getDb(), listMembers(), persona, getEnv().INDEX_FILE_NAME, today);

  return (
    <>
      <PageHeader
        title={area.label}
        description="Quatro passos, com links, para entender a Liga e começar. O texto vem dos documentos de direção da pasta; nada é reescrito nem completado."
      />

      {!view.hasDirection ? (
        <div className="mb-8">
          <Notice tone="warn">
            Nenhum documento de direção foi lido ainda. Conecte a pasta e aguarde a sincronização; nada aqui é inventado na falta deles.
          </Notice>
        </div>
      ) : null}

      <Step n={1} title="Propósito e frentes">
        {view.purpose.length === 0 ? (
          <p>Os documentos lidos não trazem uma descrição do propósito.</p>
        ) : (
          view.purpose.map((p, i) => (
            <p key={`${p.doc.fileId}-${i}`}>
              <Quote snippet={p} />
            </p>
          ))
        )}
        <ul className="grid gap-3">
          {view.fronts.map((f) => (
            <li key={f.name} className="rounded border border-[var(--line)] p-3">
              <p>
                <strong>{f.name}</strong>
              </p>
              {f.snippets.length === 0 ? (
                <p className="text-sm">Os documentos de direção não explicam esta frente.</p>
              ) : (
                <ul className="mt-1 grid gap-1 text-sm">
                  {f.snippets.map((s, i) => (
                    <li key={`${s.doc.fileId}-${i}`}>
                      <Quote snippet={s} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Step>

      <Step n={2} title="Regras de trabalho vigentes e documentos de referência">
        {view.rules.length === 0 ? (
          <p>Nenhum documento de direção ativo traz regras em lista.</p>
        ) : (
          view.rules.map((g, gi) => (
            <div key={`${g.items[0].doc.fileId}-${gi}`}>
              <h3 className="font-semibold">
                {g.section ?? "Regras"} <span className="text-sm font-normal">({g.items[0].doc.name})</span>
              </h3>
              <ul className="mt-1 list-disc pl-5">
                {g.items.map((s, i) => (
                  <li key={i}>
                    <Quote snippet={s} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {view.rulesHidden > 0 ? (
          <p className="text-sm">
            Há mais {view.rulesHidden} item(ns) de regras que não cabem aqui: abra os documentos de referência abaixo para ler tudo.
          </p>
        ) : null}
        {view.supersedes.map((s) => (
          <p key={s.doc.fileId} className="text-sm">
            <DocLink doc={s.doc} /> {s.text}.
          </p>
        ))}
        <div>
          <h3 className="font-semibold">Documentos de referência</h3>
          <ul className="mt-1 list-disc pl-5">
            {view.references.map((d) => (
              <li key={d.fileId}>
                <DocLink doc={d} /> <span className="text-sm">({d.label})</span>
                <Provisional doc={d} />
              </li>
            ))}
          </ul>
        </div>
        {view.historical.length > 0 ? (
          <div>
            <h3 className="font-semibold">Documentos históricos (não valem como regra atual)</h3>
            <ul className="mt-1 list-disc pl-5">
              {view.historical.map((h) => (
                <li key={h.doc.fileId}>
                  <DocLink doc={h.doc} />
                  {h.supersededBy ? <span className="text-sm"> — substituído por {h.supersededBy}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Step>

      <Step n={3} title="Onde estão as atividades">
        {view.registry.status === "ok" ? (
          <p>
            A fonte inicial das atividades é <strong>{view.registry.fileName}</strong>, aba <strong>{view.registry.sheet}</strong>, apontada por{" "}
            <strong>{view.registry.indexName}</strong>
            {view.registry.webUrl?.startsWith("https://") ? (
              <>
                {" "}
                (
                <a href={view.registry.webUrl} className={link}>
                  abrir no Drive
                </a>
                )
              </>
            ) : null}
            {view.registry.importedAt ? <>, importada em {formatDateTimeBR(view.registry.importedAt)}</> : null}. Desde a importação, o registro oficial
            é esta aplicação: as mudanças aprovadas ficam no histórico de cada atividade.
          </p>
        ) : (
          <Notice tone="warn" title="Fonte das atividades não identificada:">
            {view.registry.reason}
          </Notice>
        )}
        <p>
          Para achar as suas, abra{" "}
          <Link href="/minhas-atividades" className={link}>
            Minhas atividades
          </Link>
          ; o painel da Liga está em{" "}
          <Link href="/atividades" className={link}>
            Todas as atividades
          </Link>
          .
        </p>
      </Step>

      <Step n={4} title="Sua primeira ação">
        {!persona ? (
          <p>Escolha uma persona no topo da página para ver a sua primeira ação.</p>
        ) : view.firstAction.kind === "activity" ? (
          <div className="rounded border border-[var(--line)] p-3">
            <p>
              <Link href={`/atividades/${encodeURIComponent(view.firstAction.activity.id)}`} className={link}>
                {view.firstAction.activity.id} · {view.firstAction.activity.title}
              </Link>{" "}
              {view.firstAction.activity.status === "bloqueada" ? <StatusBadge tone="danger">Bloqueada</StatusBadge> : null}
            </p>
            <p className="text-sm">
              Prazo: <DueDate dueDate={view.firstAction.activity.dueDate} today={today} />
              {view.firstAction.activity.nextStep ? ` · próximo passo: ${view.firstAction.activity.nextStep}` : ""}
            </p>
          </div>
        ) : (
          <>
            <p>
              <strong>
                {view.firstAction.allDone ? "Todas as suas atividades estão concluídas." : "Você ainda não tem atividades atribuídas."}
              </strong>{" "}
              {view.firstAction.steps.length > 0
                ? "Comece pelos passos do guia vigente:"
                : "O guia vigente não traz passos numerados; leia os documentos de referência no passo 2."}
            </p>
            {view.firstAction.steps.length > 0 ? (
              <ol className="list-decimal pl-5">
                {view.firstAction.steps.map((s, i) => (
                  <li key={i}>
                    <Quote snippet={s} />
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        )}
      </Step>
    </>
  );
}
