import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { DRIVE_READONLY_SCOPE, missingGoogleSettings, parseEnv } from "./env";

describe("parseEnv", () => {
  it("aplica os padrões quando nada está definido", () => {
    const env = parseEnv({});
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
    expect(env.GOOGLE_REDIRECT_URI).toBe("http://localhost:3000/api/auth/google/callback");
    expect(env.GOOGLE_DRIVE_SCOPE).toBe(DRIVE_READONLY_SCOPE);
    expect(env.SYNC_INTERVAL_SECONDS).toBe(60);
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5-5");
    expect(env.AI_PROVIDER).toBe("disabled");
    expect(env.DATABASE_PATH).toBe("data/app.db");
  });

  it("trata CHAVE= vazia como ausente", () => {
    const env = parseEnv({ GOOGLE_CLIENT_ID: "  ", SYNC_INTERVAL_SECONDS: "" });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.SYNC_INTERVAL_SECONDS).toBe(60);
  });

  it("ativa a IA quando há chave da Anthropic", () => {
    expect(parseEnv({ ANTHROPIC_API_KEY: "chave-ficticia" }).AI_PROVIDER).toBe("anthropic");
  });

  it("deriva o callback da URL base", () => {
    expect(parseEnv({ APP_BASE_URL: "http://localhost:3001/" }).GOOGLE_REDIRECT_URI).toBe(
      "http://localhost:3001/api/auth/google/callback",
    );
  });

  it("recusa escopo diferente de drive.readonly", () => {
    expect(() => parseEnv({ GOOGLE_DRIVE_SCOPE: "https://www.googleapis.com/auth/drive" })).toThrow(AppError);
  });

  it("valida a chave de cifra (32 bytes base64)", () => {
    expect(() => parseEnv({ APP_ENCRYPTION_KEY: "curta" })).toThrow(/APP_ENCRYPTION_KEY/);
    const key = randomBytes(32).toString("base64");
    expect(parseEnv({ APP_ENCRYPTION_KEY: key }).APP_ENCRYPTION_KEY).toBe(key);
  });

  it("lista só os nomes das variáveis inválidas, nunca os valores", () => {
    try {
      parseEnv({ SYNC_INTERVAL_SECONDS: "5", APP_ENCRYPTION_KEY: "valor-secreto-invalido" });
      expect.unreachable();
    } catch (error) {
      const message = (error as AppError).safeMessage;
      expect(message).toContain("SYNC_INTERVAL_SECONDS");
      expect(message).toContain("APP_ENCRYPTION_KEY");
      expect(message).not.toContain("valor-secreto-invalido");
    }
  });

  it("informa o que falta para conectar o Google", () => {
    expect(missingGoogleSettings(parseEnv({ GOOGLE_CLIENT_ID: "id" }))).toEqual([
      "GOOGLE_CLIENT_SECRET",
      "DRIVE_TEST_FOLDER_ID",
      "APP_ENCRYPTION_KEY",
    ]);
  });
});
