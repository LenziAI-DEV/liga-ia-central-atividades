import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registryImportHook } from "@/server/activities/import-hook";
import { getActivityView } from "@/server/activities/activity-queries";
import { classifySources } from "@/server/authority/classifier";
import { parseIndex } from "@/server/authority/index-parser";
import { resolvePrecedence } from "@/server/authority/precedence-resolver";
import { createInitialLoadDrive } from "@/server/drive/fake-seed";
import { extractMarkdown } from "@/server/extract/markdown";
import { findMember, loadMembers } from "@/server/persona/members";
import { runSync } from "@/server/sync/sync-service";
import { steppingClock, testDb } from "../../../tests/helpers/db";
import { fixtureText } from "../../../tests/helpers/fixtures";
import { OFFICIAL_ACTIVITIES } from "../../../tests/helpers/ai-context";
import { enqueueAnalyses, processQueue } from "./analysis-service";
import { fixtureProvider, RecordedProvider } from "./recorded-provider";
import type { ExtractionItem } from "./schema";
import { pendingChangesFor } from "./suggestion-queries";
import { reviewSuggestion } from "./suggestion-service";
import { validateExtraction, type ValidationContext } from "./validator";

const members = loadMembers();
const ATA03 = fixtureText("02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md");

function ctxFor(text: string): ValidationContext {
  const doc = extractMarkdown(text);
  return { documentText: doc.text, sections: doc.sections, members, fronts: ["Growth", "Formação", "Operações"], activities: OFFICIAL_ACTIVITIES };
}

function item(partial: Partial<ExtractionItem>): ExtractionItem {
  return { kind: "update", target_activity_id: "ACT-102", title: null, owners: [], due_date: null, due_date_text: null, next_step: null, front: null, status: null, evidence: "", rationale: "r", uncertainties: [], ...partial };
}
const out = (...items: ExtractionItem[]) => ({ document_summary: "s", items });

async function world(extraAta = true) {
  const db = testDb();
  const { drive } = createInitialLoadDrive(join(process.cwd(), "dados_ficticios"));
  const clock = steppingClock();
  const sync = () => runSync({ db, gateway: drive, rootFolderId: drive.rootId, clock, afterSync: [registryImportHook("INDEX.md")] }, "scheduled");
  await sync();
  const id = extraAta ? drive.addFile({ name: "Ata_2026-10-03.md", content: ATA03 }) : "";
  await sync();
  const deps = (provider = fixtureProvider()) => ({ db, provider, members, clock, indexFileName: "INDEX.md", maxInputChars: 60_000 });
  const run = async (provider = fixtureProvider()) => {
    enqueueAnalyses(db, "INDEX.md", clock);
    return processQueue(deps(provider));
  };
  return { db, drive, clock, sync, run, id, deps };
}

describe("auditoria Fases 5 e 6 — validador", () => {
  it("HIGH-1: update cujo único pedido foi descartado (prazo relativo) NÃO vira 'confirma o oficial' nem liga a ata à atividade", () => {
    const ctx = ctxFor("# Ata\n\nO checklist de onboarding `ACT-102` fica para sexta, conforme combinado na reunião.\n");
    const r = validateExtraction(
      out(item({ evidence: "O checklist de onboarding `ACT-102` fica para sexta, conforme combinado na reunião.", due_date_text: "sexta" })),
      ctx,
    );
    expect(r.suggestions).toEqual([]);
    expect(r.noAction).toEqual([expect.objectContaining({ reason: expect.stringMatching(/^requer atenção: prazo relativo/), relatedActivityId: null })]);
  });

  it("HIGH-1: dono desconhecido como único pedido também fica como 'requer atenção'", () => {
    const ctx = ctxFor("# Ata\n\nO checklist de onboarding `ACT-102` agora fica com Marina, convidada externa.\n");
    const r = validateExtraction(
      out(item({ evidence: "O checklist de onboarding `ACT-102` agora fica com Marina, convidada externa.", owners: ["Marina"] })),
      ctx,
    );
    expect(r.noAction[0]).toMatchObject({ relatedActivityId: null });
    expect(r.noAction[0].reason).toMatch(/nome desconhecido: Marina/);
  });

  it("MEDIUM-7: evidência curta demais (só o ID) é inválida; estado sem marcador no trecho fica incerto", () => {
    const ctx = ctxFor("# Ata\n\n`ACT-101`\n\nO carrossel `ACT-101` segue com a Ana e foi discutido na reunião de hoje.\n");
    const short = validateExtraction(out(item({ target_activity_id: "ACT-101", evidence: "`ACT-101`", status: "concluida" })), ctx);
    expect(short.invalid[0].reason).toMatch(/curto demais/);
    const noMarker = validateExtraction(
      out(item({ target_activity_id: "ACT-101", evidence: "O carrossel `ACT-101` segue com a Ana e foi discutido na reunião de hoje.", status: "bloqueada" })),
      ctx,
    );
    expect(noMarker.suggestions[0].uncertainFields).toContain("status");
  });

  it("MEDIUM-8: ID curto não casa dentro de outro ID (A1 x A10)", () => {
    const activities = [{ ...OFFICIAL_ACTIVITIES[0], id: "A1", title: "Zzzz yyyy" }];
    const doc = extractMarkdown("# Ata\n\nA atividade A10 teve o prazo adiado para 2026-10-20 na reunião de hoje.\n");
    const r = validateExtraction(
      out(item({ target_activity_id: "A1", evidence: "A atividade A10 teve o prazo adiado para 2026-10-20 na reunião de hoje.", due_date: "2026-10-20" })),
      { documentText: doc.text, sections: doc.sections, members, fronts: [], activities },
    );
    expect(r.suggestions).toEqual([]);
    expect(r.invalid[0].reason).toMatch(/mencionam a atividade/);
  });

  it("DN-12: título e próximo passo reescritos pelo modelo não mudam a chave (criação por evidência, update por campos estruturais)", () => {
    const ctx = ctxFor("# Ata\n\nCarla revisará a pauta da oficina e entregará a proposta de exercício até 2026-10-10.\n");
    const ev = "Carla revisará a pauta da oficina e entregará a proposta de exercício até 2026-10-10.";
    const a = validateExtraction(out(item({ kind: "create", target_activity_id: null, title: "Revisar pauta da oficina", owners: ["Carla"], evidence: ev, next_step: "A" })), ctx).suggestions[0];
    const b = validateExtraction(out(item({ kind: "create", target_activity_id: null, title: "Proposta de exercício prático", owners: ["Carla"], evidence: ev, next_step: "B" })), ctx).suggestions[0];
    expect(a.dedupeKey).toBe(b.dedupeKey);
    const docC = ctxFor(ATA03);
    const evC = "O prazo para entregar a versão de aprovação mudou de 2026-10-05 para **2026-10-07**.";
    const u1 = validateExtraction(out(item({ target_activity_id: "ACT-101", evidence: evC, due_date: "2026-10-07", next_step: "Fechar o roteiro" })), docC).suggestions[0];
    const u2 = validateExtraction(out(item({ target_activity_id: "ACT-101", evidence: evC, due_date: "2026-10-07", next_step: "Finalizar roteiro e mandar ao Bruno" })), docC).suggestions[0];
    expect(u1.dedupeKey).toBe(u2.dedupeKey);
  });
});

describe("auditoria Fases 5 e 6 — fila e revisão", () => {
  it("HIGH-2: análise 'running' presa por queda do processo volta para a fila e é concluída", async () => {
    const w = await world();
    enqueueAnalyses(w.db, "INDEX.md", w.clock);
    w.db.run("UPDATE document_analyses SET status = 'running'");
    await processQueue(w.deps());
    expect(w.db.get("SELECT 1 AS x FROM document_analyses WHERE status = 'running'")).toBeUndefined();
    expect(w.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM suggestions")?.n).toBeGreaterThan(0);
  });

  it("HIGH-4: a fonte muda enquanto o modelo trabalha: nada é gravado para a versão velha", async () => {
    const w = await world();
    enqueueAnalyses(w.db, "INDEX.md", w.clock);
    const provider = new RecordedProvider((req) => {
      // Simula o sync trazendo uma versão nova durante a chamada ao modelo.
      w.db.run("UPDATE sources SET processed_hash = 'hash-novo' WHERE name = 'Ata_2026-10-03.md'");
      return fixtureProvider().extract(req).then((r) => r.output);
    });
    await processQueue(w.deps(provider));
    expect(w.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM suggestions")?.n).toBe(0);
    expect(w.db.get<{ error_code: string }>("SELECT error_code FROM document_analyses WHERE file_id = ?", w.id)?.error_code).toBe("obsolete");
    // A chamada paga continua registrada.
    expect(w.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM ai_calls")?.n).toBeGreaterThan(0);
  });

  it("HIGH-4/MEDIUM-6: sugestão de versão antiga não pode ser aceita, mas pode ser rejeitada", async () => {
    const w = await world();
    await w.run();
    const s = w.db.get<{ id: number }>("SELECT id FROM suggestions WHERE kind = 'update'")!;
    const bruno = findMember(members, "bruno")!;
    w.db.run("UPDATE sources SET processed_hash = 'outra-versao' WHERE name = 'Ata_2026-10-03.md'");
    expect(reviewSuggestion(w.db, { id: s.id, action: "accept", reviewer: bruno }, members, w.clock)).toMatchObject({ ok: false, code: "stale" });
    expect(getActivityView(w.db, members, "ACT-101")?.dueDate).toBe("2026-10-05");
    w.db.run("UPDATE suggestions SET stale_since = ? WHERE id = ?", "2026-10-01T00:00:00.000Z", s.id);
    expect(reviewSuggestion(w.db, { id: s.id, action: "reject", reviewer: bruno, reason: "versão antiga" }, members, w.clock)).toMatchObject({ ok: true, status: "rejeitada" });
  });

  it("MEDIUM-5: ata que deixa de ser ata (passa a histórico) deixa suas sugestões pendentes desatualizadas", async () => {
    const w = await world();
    await w.run();
    w.db.run("UPDATE source_contents SET extracted_json = REPLACE(extracted_json, 'data_da_reuniao', 'x_data') WHERE file_id = ?", w.id);
    w.db.run("UPDATE sources SET doc_date = NULL WHERE file_id = ?", w.id);
    enqueueAnalyses(w.db, "INDEX.md", w.clock);
    expect(w.db.get("SELECT 1 AS x FROM suggestions WHERE review_status = 'pendente' AND stale_since IS NULL AND origin = 'ai'")).toBeUndefined();
  });

  it("MEDIUM-10: espera a versão ficar estável (debounce) e respeita o teto diário de chamadas", async () => {
    const w = await world();
    enqueueAnalyses(w.db, "INDEX.md", w.clock);
    const early = await processQueue({ ...w.deps(), debounceMs: 10 * 3600_000 });
    expect(early.waiting).toBeGreaterThan(0);
    expect(w.db.get("SELECT 1 AS x FROM suggestions")).toBeUndefined();
    const capped = await processQueue({ ...w.deps(), dailyCallLimit: 0 });
    expect(capped.waiting).toBeGreaterThan(0);
    expect(w.db.get("SELECT 1 AS x FROM ai_calls")).toBeUndefined();
    const ok = await processQueue({ ...w.deps(), dailyCallLimit: 10 });
    expect(ok.done).toBeGreaterThan(0);
  });
});

describe("auditoria Fases 5 e 6 — conflito e classificador", () => {
  it("HIGH-3 (CA-F4.4): duas fontes com valores diferentes para o mesmo campo viram conflito visível, oficial intacto", async () => {
    const w = await world();
    await w.run();
    const first = w.db.get<{ id: number }>("SELECT id FROM suggestions WHERE kind = 'update'")!;
    w.db.run(
      `INSERT INTO suggestions (analysis_id, origin, kind, target_activity_id, source_file_id, source_version, rationale, uncertainties_json, dedupe_key, created_at)
       VALUES (NULL, 'registry_diff', 'update', 'ACT-101', (SELECT source_file_id FROM suggestions WHERE id = ?), (SELECT source_version FROM suggestions WHERE id = ?), 'r', '[]', 'k2', '2026-10-01T00:00:00.000Z')`,
      first.id,
      first.id,
    );
    const second = Number(w.db.get<{ id: number }>("SELECT MAX(id) AS id FROM suggestions")!.id);
    w.db.run("INSERT INTO suggestion_fields (suggestion_id, field, current_value_json, proposed_value_json) VALUES (?, 'due_date', '\"2026-10-05\"', '\"2026-10-09\"')", second);
    const view = getActivityView(w.db, members, "ACT-101")!;
    const changes = pendingChangesFor(w.db, "ACT-101");
    const { conflicts, official } = resolvePrecedence(view, changes, false);
    expect(conflicts.map((c) => c.field)).toEqual(["due_date"]);
    expect(conflicts[0].values.map((v) => v.suggestionId).sort()).toEqual([first.id, second].sort());
    expect(official.dueDate).toBe("2026-10-05");
  });

  it("MEDIUM-9: 'substitui: novo_guia.md' não torna 'guia.md' histórico; token numérico não gera 'possível conflito'", () => {
    const db = testDb();
    db.run("INSERT INTO app_settings (key, value, updated_at) VALUES ('root_folder', '{\"id\":\"root\",\"name\":\"P\",\"url\":null}', 'x')");
    const add = (id: string, name: string, kind: "md" | "xlsx", text: string | null) => {
      db.run("INSERT INTO sources (file_id, name, mime_type, kind, parent_id, path, sync_status, first_seen_at, last_seen_at) VALUES (?, ?, 'x', ?, 'root', ?, 'processed', 'x', 'x')", id, name, kind, name);
      if (text) db.run("INSERT INTO source_contents (file_id, content_hash, extracted_json, extracted_at, byte_size) VALUES (?, 'h', ?, 'x', 1)", id, JSON.stringify(extractMarkdown(text)));
    };
    add("i", "INDEX.md", "md", "fonte das atividades: `Atividades_2026.xlsx`");
    add("g", "guia.md", "md", "# Guia\n\ntexto");
    add("n", "novo_guia.md", "md", "# Novo\n\nstatus: ativo\nsubstitui: algum_outro.md\n");
    add("o", "Orcamento_2026.xlsx", "xlsx", null);
    db.run("UPDATE source_contents SET extracted_json = ? WHERE file_id = 'o'", "null");
    const c = classifySources(db, "INDEX.md");
    expect(c.get("g")?.class).toBe("sem_autoridade");
    expect(c.get("o")?.possibleConflict).toBe(false);
  });

  it("MEDIUM-9: índice em voz ativa ('X substitui Y') marca Y como superado, não X", () => {
    const p = parseIndex("`Novo_plano.md` substitui `Plano_antigo.md` nas regras de aprovação.");
    expect(p.superseded).toEqual(["Plano_antigo.md"]);
    expect(parseIndex("`Plano_antigo.md` foi substituído por `Novo_plano.md`.").superseded).toEqual(["Plano_antigo.md"]);
  });
});
