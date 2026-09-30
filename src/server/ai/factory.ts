import type { AppEnv } from "@/server/config/env";
import { AnthropicProvider } from "./anthropic-provider";
import { DisabledProvider } from "./disabled-provider";
import type { AiProvider } from "./provider";
import { fixtureProvider } from "./recorded-provider";

/** Escolhe o provedor pela configuração: sem chave a análise fica pendente e o app segue (F7.10). */
export function createProvider(env: AppEnv): AiProvider {
  if (env.AI_PROVIDER === "disabled") return new DisabledProvider("disabled");
  if (env.AI_PROVIDER === "recorded") return fixtureProvider();
  if (!env.ANTHROPIC_API_KEY) return new DisabledProvider("not_configured");
  return new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL, effort: env.AI_EFFORT });
}
