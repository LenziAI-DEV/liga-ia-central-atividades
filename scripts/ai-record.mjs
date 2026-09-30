// Grava as respostas reais do modelo em tests/fixtures/ai/ (gasta tokens; chave do .env.local).
// Uso: npm run ai:record            (todas)   |   RECORD_ONLY=ata_injecao npm run ai:record
import { spawnSync } from "node:child_process";
const result = spawnSync("npx", ["vitest", "run", "tests/ai/record.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, RECORD_AI: "1" },
});
process.exit(result.status ?? 1);
