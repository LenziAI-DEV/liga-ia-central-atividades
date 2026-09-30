import { displayQuote } from "@/lib/field-format";
import { filterActivities, listActivityViews, sortByDue, distinctFronts, type ActivityView } from "@/server/activities/activity-queries";
import { AUTHORITY_LABEL, classifySources, type AuthorityClass } from "@/server/authority/classifier";
import { resolveRegistry } from "@/server/authority/registry-locator";
import type { Db } from "@/server/db/client";
import { getContent, listTrackedSources, type SourceRow } from "@/server/db/repos/sources-repo";
import type { TextExtract } from "@/server/extract/types";
import { nameKey, type Member } from "@/server/persona/members";
import { readBlocks, sentences } from "./doc-blocks";

export interface DocRef {
  fileId: string;
  name: string;
  webUrl: string | null;
  label: string;
  /** Documento com `status: parcial`: o que ele diz é provisório (F10.2). */
  provisional: boolean;
  confirmBy: string | null;
  updatedAt: string | null;
}

export interface Snippet {
  text: string;
  doc: DocRef;
}

export interface OnboardingView {
  /** Falso quando nenhum documento de direção foi lido: a página diz isso em vez de inventar. */
  hasDirection: boolean;
  purpose: Snippet[];
  fronts: Array<{ name: string; snippets: Snippet[] }>;
  rules: Array<{ section: string | null; items: Snippet[] }>;
  /** "Este documento substitui X ...", dito pelo próprio documento de direção ativo. */
  supersedes: Array<{ doc: DocRef; text: string }>;
  historical: Array<{ doc: DocRef; supersededBy: string | null }>;
  references: DocRef[];
  registry:
    | { status: "ok"; fileId: string; fileName: string; webUrl: string | null; sheet: string; indexName: string; importedAt: string | null }
    | { status: "pending"; reason: string };
  firstAction: { kind: "activity"; activity: ActivityView } | { kind: "none"; steps: Snippet[] };
}

const MAX_FRONT_SNIPPETS = 3;
const MAX_RULES = 12;
const MAX_STEPS = 4;

const DIRECTION: ReadonlySet<AuthorityClass> = new Set(["direcao_ativo", "direcao_parcial"]);

function toRef(source: SourceRow, label: string, meta: Record<string, string>, provisional: boolean): DocRef {
  return {
    fileId: source.file_id,
    name: source.name,
    webUrl: source.web_url,
    label,
    provisional,
    confirmBy: provisional ? (meta.responsavel_por_confirmar ?? null) : null,
    updatedAt: meta.atualizado_em ?? null,
  };
}

function mentions(text: string, frontKey: string): boolean {
  const escaped = frontKey.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(nameKey(text));
}

interface DirectionDoc {
  ref: DocRef;
  extract: TextExtract;
  active: boolean;
}

/**
 * "Comece aqui" (F10): montado só com trechos literais dos documentos de direção, sem modelo
 * (DEC-008). Nenhuma frase é reescrita ou completada; o que é provisório aparece como tal.
 */
export function getOnboarding(db: Db, members: readonly Member[], persona: Member | null, indexFileName: string, today: string): OnboardingView {
  const classes = classifySources(db, indexFileName);
  const resolution = resolveRegistry(db, indexFileName);
  const indexId = resolution.index?.file_id;
  const tracked = listTrackedSources(db);

  const docs: DirectionDoc[] = [];
  const historical: OnboardingView["historical"] = [];
  const references: DocRef[] = [];
  for (const source of tracked) {
    const c = classes.get(source.file_id);
    if (!c) continue;
    const extracted = getContent(db, source.file_id)?.extracted;
    const meta = extracted?.kind === "text" ? extracted.metadata : {};
    if (c.class === "historico") {
      historical.push({ doc: toRef(source, AUTHORITY_LABEL[c.class], meta, false), supersededBy: c.supersededBy });
      continue;
    }
    if (!DIRECTION.has(c.class) || source.sync_status !== "processed") continue;
    const ref = toRef(source, AUTHORITY_LABEL[c.class], meta, c.class === "direcao_parcial");
    references.push(ref);
    if (source.file_id !== indexId && extracted?.kind === "text") {
      docs.push({ ref, extract: extracted, active: c.class === "direcao_ativo" });
    }
  }
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR");
  references.sort(byName);
  docs.sort((a, b) => byName(a.ref, b.ref));
  historical.sort((a, b) => byName(a.doc, b.doc));

  const blocks = docs.map((d) => ({ d, blocks: readBlocks(d.extract) }));

  // Propósito: o parágrafo de abertura do documento (antes da primeira seção), se houver.
  const purpose: Snippet[] = [];
  for (const { d, blocks: bs } of blocks) {
    const opening = bs.find((b) => b.kind === "paragraph" && b.beforeFirstHeading);
    if (opening) purpose.push({ text: displayQuote(opening.text), doc: d.ref });
  }
  // Documentos provisórios depois dos ativos: o que é oficial vem antes.
  purpose.sort((a, b) => Number(a.doc.provisional) - Number(b.doc.provisional));

  // Frentes: as conhecidas (membros e atividades), com as frases que as citam nos documentos de direção.
  const frontNames = [...new Set([...members.map((m) => m.front), ...distinctFronts(listActivityViews(db, members))])].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const fronts = frontNames.map((name) => {
    const key = nameKey(name);
    const snippets: Snippet[] = [];
    for (const { d, blocks: bs } of blocks) {
      for (const b of bs) {
        // Itens de lista valem inteiros; parágrafos são divididos em frases.
        const candidates = b.kind === "item" ? [b.text] : sentences(b.text);
        for (const s of candidates) {
          if (snippets.length >= MAX_FRONT_SNIPPETS) break;
          if (!mentions(s, key)) continue;
          // Lista de frentes ("são Growth, Formação e Operações") não explica nenhuma delas.
          if (frontNames.filter((n) => mentions(s, nameKey(n))).length > 1 && b.kind === "paragraph") continue;
          snippets.push({ text: displayQuote(s), doc: d.ref });
        }
      }
    }
    return { name, snippets };
  });

  // Regras: só itens de documentos de direção ativos (nunca de parciais, históricos ou atas).
  const groups = new Map<string, Snippet[]>();
  let ruleCount = 0;
  for (const { d, blocks: bs } of blocks) {
    if (!d.active) continue;
    for (const b of bs) {
      if (b.kind !== "item" || ruleCount >= MAX_RULES) continue;
      const key = `${d.ref.fileId}|${b.section ?? ""}`;
      const list = groups.get(key) ?? [];
      list.push({ text: displayQuote(b.text), doc: d.ref });
      groups.set(key, list);
      ruleCount++;
    }
  }
  const rules = [...groups.entries()].map(([key, items]) => ({ section: key.slice(key.indexOf("|") + 1) || null, items }));

  const supersedes = docs
    .filter((d) => d.active && d.extract.metadata.substitui)
    .map((d) => ({ doc: d.ref, text: `substitui ${d.extract.metadata.substitui}` }));

  const importedAt =
    db.get<{ t: string | null }>("SELECT MAX(imported_at) AS t FROM registry_imports WHERE kind = 'initial'")?.t ?? null;
  const registry: OnboardingView["registry"] =
    resolution.status === "ok"
      ? {
          status: "ok",
          fileId: resolution.source.file_id,
          fileName: resolution.source.name,
          webUrl: resolution.source.web_url,
          sheet: resolution.sheet.name,
          indexName: resolution.index.name,
          importedAt,
        }
      : { status: "pending", reason: resolution.reason };

  let firstAction: OnboardingView["firstAction"] = { kind: "none", steps: [] };
  const mine = persona
    ? sortByDue(filterActivities(listActivityViews(db, members), { ownerId: persona.id, openOnly: true }, today))
    : [];
  if (mine.length > 0) firstAction = { kind: "activity", activity: mine[0] };
  else {
    // Sem atividade atribuída: os passos iniciais do guia vigente (lista numerada, senão a primeira lista).
    const items = blocks.filter((x) => x.d.active).flatMap((x) => x.blocks.flatMap((b) => (b.kind === "item" ? [{ b, d: x.d }] : [])));
    const numbered = items.filter((i) => i.b.kind === "item" && i.b.ordered);
    const pick = (numbered.length > 0 ? numbered : items).slice(0, MAX_STEPS);
    firstAction = { kind: "none", steps: pick.map((i) => ({ text: displayQuote(i.b.text), doc: i.d.ref })) };
  }

  return { hasDirection: docs.length > 0, purpose, fronts, rules, supersedes, historical, references, registry, firstAction };
}
