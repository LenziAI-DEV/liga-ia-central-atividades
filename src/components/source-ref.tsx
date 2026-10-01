import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeBR } from "@/lib/datetime";
import type { ActivitySource } from "@/server/activities/activity-queries";

/** Referência a uma fonte: detalhe interno, link ao Drive e aviso se ela sumiu (CA-F3.4, CA-F6.4). */
export function SourceRef({ source }: { source: ActivitySource }) {
  return (
    <>
      <Link href={`/fontes/${encodeURIComponent(source.fileId)}`} className="text-[var(--primary)] underline underline-offset-2">
        {source.name}
      </Link>
      {source.webUrl?.startsWith("https://") ? (
        <>
          {" "}
          (
          <a href={source.webUrl} className="text-[var(--primary)] underline underline-offset-2">
            abrir no Drive
          </a>
          )
        </>
      ) : null}
      {source.unavailableSince !== null ? (
        <>
          {" "}
          <StatusBadge tone="danger">
            Fonte indisponível{source.unavailableSince ? ` desde ${formatDateTimeBR(source.unavailableSince)}` : ""}
          </StatusBadge>
        </>
      ) : null}
    </>
  );
}
