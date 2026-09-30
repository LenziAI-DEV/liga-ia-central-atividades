import type { ExtractionOutput } from "./schema";

export type AiErrorKind =
  | "disabled"
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "refusal"
  | "truncated"
  | "schema_invalid"
  | "too_long";

/** Falha da camada de IA, com mensagem segura para a tela. Nunca carrega o conteúdo do documento. */
export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    readonly safeMessage: string,
    options?: { cause?: unknown },
  ) {
    super(safeMessage, options);
    this.name = "AiError";
  }
}

export interface AiRequest {
  /** Identificação só para logs e gravação de fixtures (nunca vai ao modelo). */
  label: string;
  system: string;
  user: string;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface AiResult {
  output: ExtractionOutput;
  usage: AiUsage;
  model: string;
  latencyMs: number;
  /** Custo estimado em US$ pela tabela de preços; null se o modelo não consta. */
  costUsd: number | null;
}

/** A IA só propõe: nenhuma ferramenta de ação, só o esquema de saída (ADR-09, F7.8). */
export interface AiProvider {
  readonly name: "anthropic" | "recorded" | "disabled";
  extract(request: AiRequest): Promise<AiResult>;
}

/** US$ por milhão de tokens (entrada, saída), preços públicos de 2026-09. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(model: string, usage: AiUsage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
