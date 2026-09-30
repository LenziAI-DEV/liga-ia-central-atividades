/** Ambiente do servidor de teste: Drive falso, IA gravada e um banco próprio em data/e2e/. */
export function e2eEnv(dbName: string, port: number): Record<string, string> {
  return {
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next-e2e",
    APP_BASE_URL: `http://localhost:${port}`,
    DRIVE_MODE: "fake",
    FAKE_DRIVE_EXTRA_DIR: "e2e/drive-extra",
    AI_PROVIDER: "recorded",
    DATABASE_PATH: `data/e2e/${dbName}.db`,
    AI_DEBOUNCE_SECONDS: "0",
    SYNC_INTERVAL_SECONDS: "600",
    LOG_LEVEL: "warn",
  };
}
