import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { redact } from "./redact";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const LOG_DIR = join("data", "logs");
const LOG_FILE = join(LOG_DIR, "app.jsonl");
const MAX_BYTES = 5 * 1024 * 1024;

function threshold(): number {
  const level = (process.env.LOG_LEVEL ?? "info") as Level;
  return ORDER[level] ?? ORDER.info;
}

function appendToFile(line: string) {
  if (process.env.VITEST) return;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    try {
      if (statSync(LOG_FILE).size > MAX_BYTES) renameSync(LOG_FILE, `${LOG_FILE}.1`);
    } catch {
      // arquivo ainda não existe
    }
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Log em arquivo é best-effort: nunca derruba a aplicação.
  }
}

function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as object) });
  if (!process.env.VITEST || level === "error") {
    (level === "error" || level === "warn" ? console.error : console.log)(line);
  }
  appendToFile(line);
}

/** Logger estruturado (JSON por linha) com redação de segredos (ADR-16). */
export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => log("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => log("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => log("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => log("error", event, fields),
};
