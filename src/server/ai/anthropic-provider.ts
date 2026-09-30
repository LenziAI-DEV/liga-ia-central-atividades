import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AiError, estimateCostUsd, type AiProvider, type AiRequest, type AiResult } from "./provider";
import { ExtractionSchema } from "./schema";

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  effort?: "low" | "medium" | "high";
  timeoutMs?: number;
  maxTokens?: number;
}

/**
 * Saída estruturada com `output_config.format` (JSON Schema gerado do zod). Sem ferramentas e sem
 * `tool_choice`: o modelo só devolve o objeto. Checa `stop_reason` antes de ler (refusal, max_tokens).
 * O pensamento adaptativo é o padrão do modelo; o `effort` controla o gasto. O validador continua
 * sendo a autoridade final (ADR-09).
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs ?? 120_000, maxRetries: 2 });
  }

  async extract(request: AiRequest): Promise<AiResult> {
    const started = Date.now();
    let response;
    try {
      response = await this.client.messages.parse({
        model: this.options.model,
        max_tokens: this.options.maxTokens ?? 16_000,
        system: request.system,
        messages: [{ role: "user", content: request.user }],
        output_config: { effort: this.options.effort ?? "medium", format: zodOutputFormat(ExtractionSchema) },
      });
    } catch (error) {
      throw translate(error);
    }
    if (response.stop_reason === "refusal") {
      throw new AiError("refusal", "O modelo recusou analisar este documento.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("truncated", "A resposta do modelo foi cortada antes de terminar.");
    }
    if (!response.parsed_output) {
      throw new AiError("schema_invalid", "A resposta do modelo não seguiu o formato esperado.");
    }
    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    return {
      output: response.parsed_output,
      usage,
      model: response.model,
      latencyMs: Date.now() - started,
      costUsd: estimateCostUsd(response.model, usage),
    };
  }
}

function translate(error: unknown): AiError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("auth", "A chave da Anthropic foi recusada. Confira ANTHROPIC_API_KEY no .env.local.", { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limited", "Limite de uso da API atingido; a análise será tentada de novo.", { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError("timeout", "A análise por IA demorou demais e foi interrompida.", { cause: error });
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError("schema_invalid", "A API recusou o pedido de análise. Detalhes no log do servidor.", { cause: error });
  }
  return new AiError("unavailable", "Não foi possível falar com a API da Anthropic agora.", { cause: error });
}
