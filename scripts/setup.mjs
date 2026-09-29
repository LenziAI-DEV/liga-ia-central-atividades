// Prepara o .env.local: copia o .env.example e gera APP_ENCRYPTION_KEY.
// Nunca imprime valores de variáveis.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const EXAMPLE = ".env.example";
const TARGET = ".env.local";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(
    `Node ${process.versions.node} detectado. Este projeto exige Node 22.13 ou superior (recomendado: 24 LTS).`,
  );
  process.exit(1);
}

const existed = existsSync(TARGET);
let content = readFileSync(existed ? TARGET : EXAMPLE, "utf8");

const keyLine = /^APP_ENCRYPTION_KEY=(.*)$/m;
const match = content.match(keyLine);
let generated = false;
if (!match) {
  content += `\nAPP_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\n`;
  generated = true;
} else if (!match[1].trim()) {
  content = content.replace(keyLine, `APP_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
  generated = true;
}

writeFileSync(TARGET, content, { mode: 0o600 });

console.log(existed ? "• .env.local já existia (mantido)." : "✔ .env.local criado a partir do .env.example.");
console.log(generated ? "✔ APP_ENCRYPTION_KEY gerada." : "• APP_ENCRYPTION_KEY já definida (mantida).");

const filled = (name) => new RegExp(`^${name}=\\S+`, "m").test(content);
const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "DRIVE_TEST_FOLDER_ID"].filter((name) => !filled(name));
if (missing.length) console.log(`→ Preencha no .env.local: ${missing.join(", ")} (veja o README).`);
if (!filled("ANTHROPIC_API_KEY")) {
  console.log("→ Opcional: ANTHROPIC_API_KEY (sem ela, a análise de atas por IA fica desativada).");
}
