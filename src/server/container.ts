import "server-only";
import { join } from "node:path";
import { systemClock } from "@/lib/datetime";
import { registryImportHook } from "@/server/activities/import-hook";
import { analysisHook } from "@/server/ai/analysis-hook";
import { authorizedClient } from "@/server/auth/google-oauth";
import { getConnection, markReauthRequired } from "@/server/auth/token-store";
import { getEnv, missingGoogleSettings } from "@/server/config/env";
import { getDb } from "@/server/db";
import { emptyCounts, type SyncTrigger } from "@/server/db/repos/sync-runs-repo";
import { createInitialLoadDrive } from "@/server/drive/fake-seed";
import type { FakeDriveGateway } from "@/server/drive/fake-drive-gateway";
import type { DriveGateway } from "@/server/drive/gateway";
import { GoogleDriveGateway } from "@/server/drive/google-drive-gateway";
import { runSync, type SyncOutcome } from "@/server/sync/sync-service";

/** Composição das dependências reais (ADR-01: módulos com portas explícitas, sem framework de DI). */

type DriveUnavailableReason = "not_configured" | "not_connected" | "reauth_required";

export type DriveContext =
  | { gateway: DriveGateway; rootFolderId: string; mode: "google" | "fake" }
  | { gateway: null; reason: DriveUnavailableReason };

const globals = globalThis as unknown as {
  __liaFakeDrive?: FakeDriveGateway;
  __liaSyncInFlight?: Promise<SyncOutcome>;
};

/** Drive falso de demonstração (`DRIVE_MODE=fake`), usado nos testes E2E. */
export function getFakeDrive(): FakeDriveGateway {
  globals.__liaFakeDrive ??= createInitialLoadDrive(join(process.cwd(), "dados_ficticios")).drive;
  return globals.__liaFakeDrive;
}

export function getDriveContext(): DriveContext {
  const env = getEnv();
  if (env.DRIVE_MODE === "fake") {
    const fake = getFakeDrive();
    return { gateway: fake, rootFolderId: fake.rootId, mode: "fake" };
  }
  if (missingGoogleSettings(env).length > 0) return { gateway: null, reason: "not_configured" };
  const db = getDb();
  const connection = getConnection(db);
  if (!connection || connection.status === "disconnected") return { gateway: null, reason: "not_connected" };
  if (connection.status === "reauth_required") return { gateway: null, reason: "reauth_required" };
  const client = authorizedClient(db, env);
  if (!client) return { gateway: null, reason: "reauth_required" };
  return { gateway: new GoogleDriveGateway(client), rootFolderId: env.DRIVE_TEST_FOLDER_ID!, mode: "google" };
}

/**
 * Pede um ciclo de sincronização; um de cada vez por processo. Se já houver um em
 * curso, devolve `already_running` sem esperar (a agregação do gatilho manual ao
 * ciclo automático entra com o scheduler, Fase 4.1).
 */
export function requestSync(trigger: SyncTrigger): Promise<SyncOutcome> {
  if (globals.__liaSyncInFlight) {
    return Promise.resolve({ runId: null, status: "already_running", counts: emptyCounts() });
  }
  const context = getDriveContext();
  if (!context.gateway) {
    return Promise.resolve({ runId: null, status: "not_connected", counts: emptyCounts(), errorCode: context.reason });
  }
  const db = getDb();
  const promise = runSync(
    {
      db,
      gateway: context.gateway,
      rootFolderId: context.rootFolderId,
      clock: systemClock,
      afterSync: [registryImportHook(getEnv().INDEX_FILE_NAME), analysisHook(getEnv())],
      onAuthError: () => markReauthRequired(db, "invalid_grant", new Date().toISOString()),
    },
    trigger,
  ).finally(() => {
    globals.__liaSyncInFlight = undefined;
  });
  globals.__liaSyncInFlight = promise;
  return promise;
}
