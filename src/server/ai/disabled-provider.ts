import { AiError, type AiProvider, type AiResult } from "./provider";

/** Sem chave ou com `AI_PROVIDER=disabled`: a análise fica pendente e o resto do app segue (F7.10). */
export class DisabledProvider implements AiProvider {
  readonly name = "disabled" as const;
  constructor(private readonly reason: "disabled" | "not_configured" = "disabled") {}

  async extract(): Promise<AiResult> {
    throw new AiError(
      this.reason,
      this.reason === "disabled"
        ? "A análise por IA está desligada (AI_PROVIDER=disabled)."
        : "A chave da Anthropic não está configurada; a análise por IA ficou pendente.",
    );
  }
}
