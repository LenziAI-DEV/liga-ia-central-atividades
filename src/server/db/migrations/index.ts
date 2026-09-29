import { migration001Core } from "./001-core";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Migrações em ordem crescente. Nunca edite uma migração já aplicada: crie outra. */
export const MIGRATIONS: readonly Migration[] = [migration001Core];
