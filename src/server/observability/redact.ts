/** Chaves cujo valor nunca pode aparecer em log (GUIA §10). */
const SENSITIVE_KEYS = new Set([
  "code",
  "state",
  "token",
  "tokens",
  "access_token",
  "refresh_token",
  "id_token",
  "code_verifier",
  "client_secret",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "password",
  "app_encryption_key",
]);

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.has(k) || k.endsWith("_token") || k.endsWith("secret") || k.includes("password");
}

/** Formatos conhecidos de credenciais do Google e da Anthropic. */
const SECRET_PATTERNS = /(ya29\.[\w.-]+|1\/\/[\w.-]+|GOCSPX-[\w-]+|sk-ant-[\w-]+)/g;
/** Parâmetros sensíveis em URLs (ex.: callback OAuth com ?code=). */
const SENSITIVE_QUERY = /([?&](?:code|state|access_token|refresh_token|client_secret|code_verifier)=)[^&\s"']+/gi;

export const REDACTED = "[redigido]";

export function redactString(value: string): string {
  return value.replace(SECRET_PATTERNS, REDACTED).replace(SENSITIVE_QUERY, `$1${REDACTED}`);
}

/** Campos de diagnóstico de erros do Google (gaxios) que podem ir para o log. */
const ERROR_DIAGNOSTIC_FIELDS = ["status", "code"] as const;

/**
 * Erro → `{name, message, status?, cause?}`, com redação. Nunca serializa `config`,
 * `response` nem cabeçalhos (podem conter o corpo da troca de token). A causa é
 * seguida até o limite de profundidade, o que também corta ciclos.
 */
function redactError(error: Error, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = { name: error.name, message: redactString(error.message) };
  const fields = error as unknown as Record<string, unknown>;
  for (const field of ERROR_DIAGNOSTIC_FIELDS) {
    if (typeof fields[field] === "number" || typeof fields[field] === "string") out[field] = fields[field];
  }
  if (error.cause !== undefined) out.cause = redact(error.cause, depth + 1);
  return out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[estrutura profunda omitida]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return redactError(value, depth);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}
