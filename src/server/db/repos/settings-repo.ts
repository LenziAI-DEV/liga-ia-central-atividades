import type { Db } from "../client";

export const SETTING = {
  rootFolder: "root_folder",
  firstLoadStartedAt: "first_load_started_at",
  registryImport: "registry_import",
} as const;

export interface RootFolder {
  id: string;
  name: string;
  url: string | null;
}

export function getSetting<T>(db: Db, key: string): T | undefined {
  const row = db.get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", key);
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setSetting(db: Db, key: string, value: unknown, now: string) {
  db.run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    now,
  );
}
