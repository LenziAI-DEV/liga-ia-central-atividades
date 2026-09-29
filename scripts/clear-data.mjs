// Apaga os dados locais do app (banco SQLite, conteúdo extraído em cache, tokens cifrados e logs).
// Os arquivos no Google Drive NÃO são afetados.
import { existsSync, rmSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const DIR = "data";

if (!existsSync(DIR)) {
  console.log("Nada a apagar: a pasta data/ não existe.");
  process.exit(0);
}

if (!process.argv.includes("--yes")) {
  if (!process.stdin.isTTY) {
    console.error("Para confirmar sem terminal interativo, use: npm run data:clear -- --yes");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "Isto apaga data/ (banco local, cache de conteúdo, tokens cifrados e logs). O Google Drive não é afetado. Continuar? (s/N) ",
  );
  rl.close();
  if (!/^s(im)?$/i.test(answer.trim())) {
    console.log("Cancelado.");
    process.exit(0);
  }
}

rmSync(DIR, { recursive: true, force: true });
console.log("✔ data/ apagada. Na próxima execução o app recria o banco e pede nova conexão com o Google.");
console.log("  Para revogar também o acesso no Google: Conta Google › Segurança › Apps de terceiros › Remover acesso.");
