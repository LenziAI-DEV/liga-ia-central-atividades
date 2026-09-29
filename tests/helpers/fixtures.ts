import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Pacote de dados fictícios da banca (versionado no repositório). */
export const DATA_DIR = join(process.cwd(), "dados_ficticios");

export function fixtureBytes(relativePath: string): Uint8Array {
  return new Uint8Array(readFileSync(join(DATA_DIR, relativePath)));
}

export function fixtureText(relativePath: string): string {
  return readFileSync(join(DATA_DIR, relativePath), "utf8");
}
