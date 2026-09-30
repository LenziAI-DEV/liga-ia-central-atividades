import Link from "next/link";
import { DueDate } from "@/components/due-date";
import { SourceRef } from "@/components/source-ref";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTimeBR } from "@/lib/datetime";
import type {
  AttentionItem,
  ConfirmedItem,
  DocumentNews,
  FeedSource,
  PendingItem,
  UncertainItem,
} from "@/server/feed/change-feed";

const KIND_LABEL: Record<string, string> = {
  created: "Atividade criada",
  updated: "Atividade editada",
  suggestion_applied: "Sugestão aprovada",
  archived: "Atividade arquivada",
};

const ATTENTION_LABEL: Record<AttentionItem["reason"], { text: string; tone: "danger" | "warn" }> = {
  bloqueada: { text: "Bloqueada", tone: "danger" },
  vencida: { text: "Prazo vencido", tone: "danger" },
  vence_hoje: { text: "Vence hoje", tone: "warn" },
  vence_em_breve: { text: "Vence em breve", tone: "warn" },
};

function Sources({ sources }: { sources: readonly FeedSource[] }) {
  if (sources.length === 0) return null;
  return (
    <p className="mt-1 text-sm">
      Fontes:{" "}
      {sources.map((s, i) => (
        <span key={s.fileId}>
          {i > 0 ? "; " : ""}
          <SourceRef
            source={{ fileId: s.fileId, name: s.name, webUrl: s.webUrl, relation: "", locator: "", unavailableSince: s.unavailable ? "" : null }}
          />
        </span>
      ))}
    </p>
  );
}

function ActivityLink({ activity }: { activity: { id: string; title: string } }) {
  return (
    <Link href={`/atividades/${encodeURIComponent(activity.id)}`} className="text-[var(--lia-blue)] underline underline-offset-2">
      {activity.id} · {activity.title}
    </Link>
  );
}

function Group({ id, title, hint, count, children }: { id: string; title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`g-${id}`} className="mb-8">
      <h2 id={`g-${id}`} className="font-serif text-2xl font-semibold">
        {title} <span className="text-base font-normal text-[var(--ink-muted)]">({count})</span>
      </h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">{hint}</p>
      {count === 0 ? <p className="mt-3">Nada neste grupo.</p> : <ul className="mt-3 grid gap-3">{children}</ul>}
    </section>
  );
}

const card = "rounded border border-[var(--line)] p-3";

export function ConfirmedGroup({ items }: { items: readonly ConfirmedItem[] }) {
  return (
    <Group id="confirmadas" title="Mudanças confirmadas" hint="Já aprovadas e registradas no histórico oficial." count={items.length}>
      {items.map((e) => (
        <li key={e.eventId} className={card}>
          <p>
            <ActivityLink activity={{ id: e.activityId, title: e.activityTitle }} />
          </p>
          <p className="text-sm">
            {KIND_LABEL[e.kind] ?? e.kind} por <strong>{e.actor}</strong> em <time dateTime={e.occurredAt}>{formatDateTimeBR(e.occurredAt)}</time>
            {e.reason ? ` · motivo: ${e.reason}` : ""}
          </p>
          {e.changes.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {e.changes.map((c, i) => (
                <li key={`${c.label}-${i}`}>
                  {c.label}: {c.before} → <strong>{c.after}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          <Sources sources={e.sources} />
        </li>
      ))}
    </Group>
  );
}

export function PendingGroup({ items }: { items: readonly PendingItem[] }) {
  return (
    <Group
      id="pendentes"
      title="Propostas pendentes de aprovação"
      hint="A IA sugeriu, mas nada mudou ainda: um revisor precisa decidir."
      count={items.length}
    >
      {items.map((p) => (
        <li key={p.suggestionId} className={card}>
          <p className="flex flex-wrap items-center gap-2">
            {p.activity ? <ActivityLink activity={p.activity} /> : <strong>Nova atividade proposta</strong>}
            {p.isNew ? <StatusBadge tone="info">Nova</StatusBadge> : null}
            {p.stale ? <StatusBadge tone="warn">Desatualizada</StatusBadge> : null}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {p.fields.map((f) => (
              <li key={f.label}>
                {f.label}: {p.kind === "update" ? `${f.current} → ` : ""}
                <strong>{f.proposed}</strong>
                {f.uncertain ? (
                  <>
                    {" "}
                    <StatusBadge tone="warn">Incerta</StatusBadge>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {p.uncertainties.length > 0 ? (
            <p className="mt-1 text-sm">Incertezas apontadas: {p.uncertainties.join(" ")}</p>
          ) : null}
          <Sources sources={[p.source]} />
          <p className="mt-1 text-sm">
            <Link href={`/sugestoes/${p.suggestionId}`} className="text-[var(--lia-blue)] underline underline-offset-2">
              Ver a sugestão e a evidência
            </Link>
          </p>
        </li>
      ))}
    </Group>
  );
}

export function UncertainGroup({ items }: { items: readonly UncertainItem[] }) {
  return (
    <Group id="incertos" title="Dados incertos ou em conflito" hint="O sistema não decide por você: confira as fontes." count={items.length}>
      {items.map((u) => (
        <li key={u.key} className={card}>
          {u.activity ? (
            <p>
              <ActivityLink activity={u.activity} />
            </p>
          ) : null}
          <p className="text-sm">{u.text}</p>
          <Sources sources={u.sources} />
          {u.suggestionId !== null ? (
            <p className="mt-1 text-sm">
              <Link href={`/sugestoes/${u.suggestionId}`} className="text-[var(--lia-blue)] underline underline-offset-2">
                Abrir a sugestão
              </Link>
            </p>
          ) : null}
        </li>
      ))}
    </Group>
  );
}

export function AttentionGroup({ items, today }: { items: readonly AttentionItem[]; today: string }) {
  return (
    <Group id="atencao" title="Precisam de atenção" hint="Suas atividades bloqueadas, vencidas ou perto do prazo." count={items.length}>
      {items.map((a) => (
        <li key={a.activityId} className={card}>
          <p className="flex flex-wrap items-center gap-2">
            <ActivityLink activity={{ id: a.activityId, title: a.title }} />
            <StatusBadge tone={ATTENTION_LABEL[a.reason].tone}>{ATTENTION_LABEL[a.reason].text}</StatusBadge>
          </p>
          <p className="text-sm">
            Prazo: <DueDate dueDate={a.dueDate} today={today} />
            {a.nextStep ? ` · próximo passo: ${a.nextStep}` : ""}
          </p>
        </li>
      ))}
    </Group>
  );
}

const DOC_KIND: Record<DocumentNews["kind"], { text: string; tone: "ok" | "info" | "danger" }> = {
  novo: { text: "Novo", tone: "ok" },
  alterado: { text: "Alterado", tone: "info" },
  indisponivel: { text: "Indisponível", tone: "danger" },
};

export function DocumentsGroup({ items }: { items: readonly DocumentNews[] }) {
  return (
    <Group
      id="documentos"
      title="Novidades dos documentos"
      hint="Documentos novos, alterados ou indisponíveis na pasta do Drive. O resumo vem da análise por IA."
      count={items.length}
    >
      {items.map((d) => (
        <li key={d.fileId} className={card}>
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={DOC_KIND[d.kind].tone}>{DOC_KIND[d.kind].text}</StatusBadge>
            <Link href={`/fontes/${encodeURIComponent(d.fileId)}`} className="text-[var(--lia-blue)] underline underline-offset-2">
              {d.name}
            </Link>
            {d.webUrl?.startsWith("https://") && d.kind !== "indisponivel" ? (
              <a href={d.webUrl} className="text-sm text-[var(--lia-blue)] underline underline-offset-2">
                abrir no Drive
              </a>
            ) : null}
          </p>
          <p className="text-sm">
            em <time dateTime={d.at}>{formatDateTimeBR(d.at)}</time>
            {d.reason ? ` · ${d.reason}` : ""}
          </p>
          {d.aiSummary ? (
            <p className="mt-1 text-sm">
              <strong>Resumo gerado por IA — confira na fonte:</strong> {d.aiSummary}
            </p>
          ) : null}
        </li>
      ))}
    </Group>
  );
}
