import { defineConfig, devices } from "@playwright/test";
import { e2eEnv } from "./e2e/env";

const PORT = 3100;

/** E2E com Drive falso e IA gravada (ADR-17): sem rede, sem custo, sem dados reais. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: e2eEnv("main", PORT),
  },
});
