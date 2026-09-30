import { migration001Core } from "./001-core";
import { migration002Activities } from "./002-activities";
import { migration003OwnerIndex } from "./003-owner-index";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Migrações em ordem crescente. Nunca edite uma migração já aplicada: crie outra. */
export const MIGRATIONS: readonly Migration[] = [migration001Core, migration002Activities, migration003OwnerIndex];
