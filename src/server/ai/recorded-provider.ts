import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AiError, type AiProvider, type AiRequest, type AiResult } from "./provider";
import { ExtractionSchema, type ExtractionOutput } from "./schema";

export type Responder = (request: AiRequest) => ExtractionOutput | AiError | Promise<ExtractionOutput | AiError>;

/**
 * Responde com saídas gravadas (ou montadas no teste), sem rede nem custo. Serve para testes
 * determinísticos e para a demonstração sem chave (`AI_PROVIDER=recorded`).
 */
export class RecordedProvider implements AiProvider {
  readonly name = "recorded" as const;
  readonly calls: AiRequest[] = [];
  constructor(private readonly respond: Responder) {}

  async extract(request: AiRequest): Promise<AiResult> {
    this.calls.push(request);
    const result = await this.respond(request);
    if (result instanceof AiError) throw result;
    return {
      output: result,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
      model: "recorded",
      latencyMs: 0,
      costUsd: 0,
    };
  }
}

export const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "ai");

/** Lê uma saída gravada de `tests/fixtures/ai/<label>.json` (formato escrito por `ai:record`). */
export function loadFixture(label: string): ExtractionOutput {
  if (!/^[a-z0-9_.-]+$/i.test(label) || label.includes("..")) throw new Error("rótulo de fixture inválido");
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, `${label}.json`), "utf8")) as { output: unknown };
  return ExtractionSchema.parse(raw.output);
}

/** Provedor que responde pelo `label` a partir das fixtures gravadas. */
export function fixtureProvider(): RecordedProvider {
  return new RecordedProvider((request) => {
    try {
      return loadFixture(request.label);
    } catch {
      return new AiError("unavailable", `Sem resposta gravada para "${request.label}".`);
    }
  });
}
