import { spawn, type ChildProcess } from "node:child_process";
import { e2eEnv } from "./env";

export interface RunningServer {
  url: string;
  stop: () => Promise<void>;
}

async function waitHealthy(url: string, child: ChildProcess) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("o servidor de teste encerrou ao iniciar");
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("o servidor de teste não respondeu a tempo");
}

/** Sobe o app de produção numa porta própria, com o banco indicado (para testar persistência com reinício). */
export async function startServer(port: number, dbName: string): Promise<RunningServer> {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, ...e2eEnv(dbName, port) },
    stdio: "ignore",
  });
  const url = `http://localhost:${port}`;
  await waitHealthy(url, child);
  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill();
      }),
  };
}
