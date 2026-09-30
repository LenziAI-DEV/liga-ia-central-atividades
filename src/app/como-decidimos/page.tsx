import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PRECEDENCE_RULE_TEXT, PRECEDENCE_SUMMARY } from "@/lib/precedence-rule";
import { AUTHORITY_LABEL, type AuthorityClass } from "@/server/authority/classifier";

export const metadata: Metadata = { title: "Como o app decide o valor oficial" };

const CLASS_MEANING: Record<AuthorityClass, string> = {
  registro_vigente: "A planilha que o índice do acervo aponta como fonte das atividades. É de onde vêm os valores de partida.",
  direcao_ativo: "Documento de orientação em vigor (índice, guia). Dá contexto, mas não altera atividades.",
  direcao_parcial: "Documento de orientação ainda provisório. É mostrado como provisório e não altera atividades.",
  ata: "Ata de reunião, identificada pela data da reunião. Gera propostas para revisão; nunca muda o oficial sozinha.",
  historico: "Documento declarado superado. Fica acessível como histórico e nunca é apresentado como regra atual.",
  sem_autoridade:
    "Qualquer outro arquivo, inclusive planilhas de nome ou formato parecido com o registro. Nunca altera atividades; quando se parece com o registro, aparece como “possível conflito”, com os motivos.",
};

export default function Page() {
  return (
    <>
      <PageHeader title="Como o app decide o valor oficial" description={PRECEDENCE_SUMMARY} />

      <section aria-labelledby="regra" className="mb-10">
        <h2 id="regra" className="text-xl font-semibold">
          A regra, do mais forte ao mais fraco
        </h2>
        <ol className="mt-3 grid gap-3">
          {PRECEDENCE_RULE_TEXT.map((rule) => (
            <li key={rule.title} className="rounded border border-[var(--line)] p-4">
              <h3 className="font-semibold">{rule.title}</h3>
              <p className="mt-1">{rule.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="classes" className="mb-10">
        <h2 id="classes" className="text-xl font-semibold">
          Como cada documento é classificado
        </h2>
        <p className="mt-2 max-w-3xl text-[var(--ink-muted)]">
          A classificação é automática e explicável: vem do que o índice aponta e dos metadados escritos no próprio documento
          (por exemplo, <code>status</code> e <code>data_da_reuniao</code>). Nenhuma IA decide isso. Na dúvida, o documento fica sem
          autoridade definida.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
          {(Object.keys(AUTHORITY_LABEL) as AuthorityClass[]).map((cls) => (
            <div key={cls} className="contents">
              <dt className="font-semibold">{AUTHORITY_LABEL[cls]}</dt>
              <dd>{CLASS_MEANING[cls]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p>
        Veja a classe e os motivos de cada arquivo em{" "}
        <Link href="/sincronizacao" className="text-[var(--lia-blue)] underline underline-offset-2">
          Estado da sincronização
        </Link>
        .
      </p>
    </>
  );
}
