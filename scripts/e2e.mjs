// Gera o build de teste numa pasta própria (.next-e2e, não interfere no app em execução) e roda o Playwright.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const env = { ...process.env, NEXT_DIST_DIR: ".next-e2e" };
const run = (args) => spawnSync(process.execPath, args, { stdio: "inherit", env }).status ?? 1;

rmSync("data/e2e", { recursive: true, force: true }); // cada execução começa com bancos novos
let status = run(["node_modules/next/dist/bin/next", "build"]);
if (status === 0) status = run(["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)]);
process.exit(status);
