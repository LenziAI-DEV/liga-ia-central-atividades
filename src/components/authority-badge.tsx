import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { Tone } from "@/lib/labels";
import { authorityLabel, type Classification } from "@/server/authority/classifier";

const TONE: Record<Classification["class"], Tone> = {
  registro_vigente: "ok",
  direcao_ativo: "info",
  direcao_parcial: "info",
  ata: "neutral",
  historico: "neutral",
  sem_autoridade: "warn",
};

/** Classe de autoridade em texto, com os motivos calculados e o caminho para a regra (F4.8, R10). */
export function AuthorityBadge({ classification }: { classification: Classification | undefined }) {
  if (!classification) return <span>—</span>;
  return (
    <div className="grid gap-1">
      <StatusBadge tone={classification.possibleConflict ? "danger" : TONE[classification.class]}>
        {authorityLabel(classification)}
      </StatusBadge>
      {classification.reasons.length > 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{classification.reasons.join("; ")}.</p>
      ) : null}
      {classification.class === "sem_autoridade" || classification.class === "historico" ? (
        <p className="text-sm">
          Não altera atividades.{" "}
          <Link href="/como-decidimos" className="text-[var(--primary)] underline underline-offset-2">
            Como o app decide
          </Link>
        </p>
      ) : null}
    </div>
  );
}
