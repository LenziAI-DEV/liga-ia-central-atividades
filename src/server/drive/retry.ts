import { isRetryableDriveError } from "./errors";

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  shouldRetry?: (error: unknown) => boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Repete `fn` com espera exponencial e jitter em erros temporários (429, 5xx, rede)
 * — [GUIA §9, §11]. Erros de permissão/ausência não são repetidos.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 4,
    baseMs = 1000,
    maxMs = 30_000,
    sleep = defaultSleep,
    random = Math.random,
    shouldRetry = isRetryableDriveError,
  } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      const delay = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + random() * 0.5);
      await sleep(delay);
    }
  }
}
