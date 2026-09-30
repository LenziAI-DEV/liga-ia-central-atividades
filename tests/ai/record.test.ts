import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "@/server/ai/anthropic-provider";
import { buildExtractPrompt } from "@/server/ai/prompts/extract-v1";
import { FIXTURE_DIR } from "@/server/ai/recorded-provider";
import { extractMarkdown } from "@/server/extract/markdown";
import { loadMembers } from "@/server/persona/members";
import { OFFICIAL_ACTIVITIES, RECORDED_DOCS } from "../helpers/ai-context";
import { DATA_DIR } from "../helpers/fixtures";

/**
 * Gravação das respostas reais do modelo (spike 6.0 e fixtures 6.6). Só roda com `RECORD_AI=1`
 * (`npm run ai:record`), porque gasta tokens. A chave vem do `.env.local` e nunca é impressa.
 */
function readEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

describe.skipIf(!process.env.RECORD_AI)("gravação das respostas reais do modelo", () => {
  const env = readEnvLocal();
  const effort = (process.env.RECORD_EFFORT as "low" | "medium" | "high" | undefined) ?? "medium";
  const only = process.env.RECORD_ONLY?.split(",");
  const members = loadMembers();

  for (const doc of RECORDED_DOCS.filter((d) => !only || only.includes(d.label))) {
    it(`grava ${doc.label} (effort ${effort})`, async () => {
      const text = readFileSync(
        doc.kind === "data" ? join(DATA_DIR, doc.path) : join(FIXTURE_DIR, "docs", doc.path),
        "utf8",
      );
      const extracted = extractMarkdown(text);
      const prompt = buildExtractPrompt({
        members: members.map((m) => ({ name: m.name, front: m.front })),
        fronts: ["Growth", "Formação", "Operações"],
        activities: OFFICIAL_ACTIVITIES,
        documentName: doc.path.split("/").pop()!,
        documentDate: extracted.metadata.data_da_reuniao ?? null,
        documentText: extracted.text,
      });
      const provider = new AnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        effort,
      });
      const result = await provider.extract({ label: doc.label, system: prompt.system, user: prompt.user });
      writeFileSync(
        join(FIXTURE_DIR, `${doc.label}.json`),
        JSON.stringify(
          { label: doc.label, model: result.model, effort, usage: result.usage, costUsd: result.costUsd, latencyMs: result.latencyMs, output: result.output },
          null,
          2,
        ) + "\n",
      );
      console.log(`[ai:record] ${doc.label}: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out, US$ ${result.costUsd?.toFixed(4)}, ${result.latencyMs} ms, ${result.output.items.length} itens`);
      expect(result.output.items).toBeDefined();
    }, 180_000);
  }
});
