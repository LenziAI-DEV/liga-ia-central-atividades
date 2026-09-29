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

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[estrutura profunda omitida]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}
