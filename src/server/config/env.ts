import "server-only";
import { z } from "zod";
import { AppError } from "@/server/errors";

export const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** `.env.local` com `CHAVE=` (vazio) equivale a não definida. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(blankToUndefined, z.string().trim().optional());

const encryptionKey = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .refine(
      (value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32,
      "precisa ter 32 bytes em base64 (gere com npm run setup)",
    )
    .optional(),
);

const EnvSchema = z.object({
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  DRIVE_TEST_FOLDER_ID: optionalText,
  APP_ENCRYPTION_KEY: encryptionKey,
  APP_BASE_URL: z.preprocess(blankToUndefined, z.url().default("http://localhost:3000")),
  GOOGLE_REDIRECT_URI: z.preprocess(blankToUndefined, z.url().optional()),
  GOOGLE_DRIVE_SCOPE: z.preprocess(
    blankToUndefined,
    z.literal(DRIVE_READONLY_SCOPE).default(DRIVE_READONLY_SCOPE),
  ),
  ANTHROPIC_API_KEY: optionalText,
  ANTHROPIC_MODEL: z.preprocess(blankToUndefined, z.string().default("claude-sonnet-5-5")),
  AI_PROVIDER: z.preprocess(blankToUndefined, z.enum(["anthropic", "recorded", "disabled"]).optional()),
  SYNC_INTERVAL_SECONDS: z.preprocess(blankToUndefined, z.coerce.number().int().min(30).max(600).default(60)),
  DRIVE_MODE: z.preprocess(blankToUndefined, z.enum(["google", "local", "fake"]).default("google")),
  LOCAL_DRIVE_DIR: optionalText,
  INDEX_FILE_NAME: z.preprocess(blankToUndefined, z.string().default("INDEX.md")),
  DATABASE_PATH: z.preprocess(blankToUndefined, z.string().default("data/app.db")),
  LOG_LEVEL: z.preprocess(blankToUndefined, z.enum(["debug", "info", "warn", "error"]).default("info")),
});

type ParsedEnv = z.infer<typeof EnvSchema>;

export type AppEnv = Omit<ParsedEnv, "GOOGLE_REDIRECT_URI" | "AI_PROVIDER"> & {
  GOOGLE_REDIRECT_URI: string;
  AI_PROVIDER: "anthropic" | "recorded" | "disabled";
};

/**
 * Valida as variáveis de ambiente. Em caso de erro, a mensagem lista apenas os
 * NOMES das variáveis inválidas, nunca os valores (F1.3).
 */
export function parseEnv(source: Record<string, string | undefined>): AppEnv {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new AppError(
      "config_invalid",
      `Configuração inválida no .env.local: ${names.join(", ")}. Confira o .env.example e o README.`,
    );
  }
  const env = result.data;
  return {
    ...env,
    GOOGLE_REDIRECT_URI:
      env.GOOGLE_REDIRECT_URI ?? `${env.APP_BASE_URL.replace(/\/+$/, "")}/api/auth/google/callback`,
    AI_PROVIDER: env.AI_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : "disabled"),
  };
}

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

const GOOGLE_REQUIRED = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "DRIVE_TEST_FOLDER_ID", "APP_ENCRYPTION_KEY"] as const;

/** Nomes das variáveis que faltam para conectar o Google Drive. */
export function missingGoogleSettings(env: AppEnv): string[] {
  return GOOGLE_REQUIRED.filter((name) => !env[name]);
}
