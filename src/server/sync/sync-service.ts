import { isValidIsoDate, type Clock } from "@/lib/datetime";
import type { Db } from "@/server/db/client";
import { SETTING, setSetting } from "@/server/db/repos/settings-repo";
import {
  deleteContent,
  getSource,
  hasContent,
  listTrackedChildren,
  listTrackedSources,
  markGone,
  markProcessed,
  recordVersion,
  saveContent,
  setStatus,
  upsertSeen,
} from "@/server/db/repos/sources-repo";
import {
  acquireRun,
  emptyCounts,
  finishRun,
  type SyncCounts,
  type SyncTrigger,
} from "@/server/db/repos/sync-runs-repo";
import { classifyFile } from "@/server/drive/classify-file";
import { DriveError } from "@/server/drive/errors";
import { MIME, type DriveGateway } from "@/server/drive/gateway";
import { walkTree, type WalkResult } from "@/server/drive/walk-tree";
import { AppError } from "@/server/errors";
import { contentHash } from "@/server/extract/normalize";
import { logger } from "@/server/observability/logger";
import { extractSource } from "./extract-source";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface AfterSyncContext {
  db: Db;
  runId: number;
  /** Fontes cujo conteúdo mudou neste ciclo (novas ou editadas). */
  changedFileIds: string[];
  clock: Clock;
}

export interface SyncDeps {
  db: Db;
  gateway: DriveGateway;
  rootFolderId: string;
  clock: Clock;
  maxFileBytes?: number;
  onAuthError?: () => void;
  /** Etapas posteriores (importação do registro, análise por IA) — fases seguintes. */
  afterSync?: Array<(context: AfterSyncContext) => void | Promise<void>>;
}

export type SyncOutcomeStatus = "success" | "partial" | "failed" | "already_running" | "not_connected";

export interface SyncOutcome {
  runId: number | null;
  status: SyncOutcomeStatus;
  counts: SyncCounts;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Um ciclo de sincronização (carga inicial, automática ou manual — ARCHITECTURE §6.3).
 * Toda a listagem acontece antes de qualquer escrita: se o Drive falhar, nada muda
 * no banco (falha nunca vira ausência, AR-16).
 */
export async function runSync(deps: SyncDeps, trigger: SyncTrigger): Promise<SyncOutcome> {
  const { db, gateway, rootFolderId, clock } = deps;
  const maxBytes = deps.maxFileBytes ?? MAX_FILE_BYTES;
  const counts = emptyCounts();
  const runId = acquireRun(db, trigger, clock.now());
  if (runId === null) return { runId: null, status: "already_running", counts };

  const now = () => clock.now().toISOString();
  logger.info("sync.run.start", { run_id: runId, trigger });

  try {
    const root = await fetchRoot(gateway, rootFolderId);
    const walk = await walkTree(gateway, rootFolderId);
    setSetting(db, SETTING.rootFolder, { id: root.id, name: root.name, url: root.webViewLink }, now());

    const seen = new Set<string>();
    const changed: string[] = [];

    for (const item of walk.items) {
      seen.add(item.id);
      counts.seen++;
      const { kind, reason } = classifyFile(item);
      upsertSeen(db, item, kind, now());

      if (kind === "folder") {
        counts.folders++;
        setStatus(db, item.id, "processed", null);
        continue;
      }
      if (kind === "unsupported" || kind === "shortcut") {
        counts.unsupported++;
        setStatus(db, item.id, "unsupported", reason ?? null);
        deleteContent(db, item.id);
        continue;
      }

      const current = getSource(db, item.id)!;
      if (current.sync_status === "processed" && current.processed_drive_version === item.version) {
        counts.unchanged++;
        continue;
      }
      if (!item.canDownload) {
        counts.failed++;
        setStatus(db, item.id, "failed", "Sem permissão para baixar o conteúdo deste arquivo.");
        continue;
      }

      try {
        const extracted = await extractSource(gateway, item, kind, maxBytes);
        const hash = contentHash(extracted);
        const meetingDate = extracted.kind === "text" ? extracted.metadata.data_da_reuniao : undefined;
        const docDate = meetingDate && isValidIsoDate(meetingDate) ? meetingDate : null;
        db.tx(() => {
          if (hash !== current.processed_hash) {
            saveContent(db, item.id, hash, extracted, now());
            recordVersion(db, item.id, hash, item.version, now());
            changed.push(item.id);
            counts.processed++;
          } else {
            // Ex.: renomeado sem mudar o conteúdo (CA-F3.3), ou de volta da lixeira
            // com o mesmo conteúdo — nesse caso o cache tinha sido apagado.
            if (!hasContent(db, item.id)) saveContent(db, item.id, hash, extracted, now());
            counts.unchanged++;
          }
          markProcessed(db, item.id, { hash, driveVersion: item.version, now: now(), docDate });
        });
      } catch (error) {
        if (error instanceof DriveError && error.kind === "auth") throw error;
        counts.failed++;
        setStatus(db, item.id, "failed", failureReason(error));
        logger.warn("sync.file.failed", { run_id: runId, file_id: item.id, error });
      }
    }

    counts.unavailable += await reconcileMissing(deps, walk, seen);

    const partial = counts.failed > 0 || walk.failedFolders.size > 0;
    const partialNote =
      walk.failedFolders.size > 0
        ? {
            code: "partial_listing",
            message: `Não foi possível listar ${walk.failedFolders.size} subpasta(s); o que estava nelas foi mantido como antes.`,
          }
        : undefined;
    finishRun(db, runId, partial ? "partial" : "success", counts, clock.now(), partialNote);
    logger.info("sync.run.finish", { run_id: runId, status: partial ? "partial" : "success", ...counts });

    for (const hook of deps.afterSync ?? []) {
      try {
        await hook({ db, runId, changedFileIds: changed, clock });
      } catch (error) {
        logger.error("sync.after_hook_failed", { run_id: runId, error });
      }
    }
    return { runId, status: partial ? "partial" : "success", counts };
  } catch (error) {
    const { code, message } = describeRunError(error);
    if (code === "auth") deps.onAuthError?.();
    finishRun(db, runId, "failed", counts, clock.now(), { code, message });
    logger.warn("sync.run.failed", { run_id: runId, error_code: code, error });
    return { runId, status: "failed", counts, errorCode: code, errorMessage: message };
  }
}

async function fetchRoot(gateway: DriveGateway, rootFolderId: string) {
  let root;
  try {
    root = await gateway.getItem(rootFolderId);
  } catch (error) {
    if (error instanceof DriveError && (error.kind === "not_found" || error.kind === "forbidden")) {
      throw new AppError(
        "root_not_found",
        "A pasta configurada em DRIVE_TEST_FOLDER_ID não foi encontrada ou a conta conectada não tem acesso a ela.",
      );
    }
    throw error;
  }
  if (root.mimeType !== MIME.folder || root.trashed) {
    throw new AppError("root_not_folder", "O ID configurado em DRIVE_TEST_FOLDER_ID não é uma pasta ativa do Drive.");
  }
  return root;
}

/**
 * Fontes que não apareceram neste ciclo. Só conclui algo quando a pasta-pai foi
 * listada por completo; confirma com `files.get` (lixeira × sem acesso × fora da
 * árvore) e propaga para o conteúdo de pastas que sumiram (F3.4, F3.7).
 */
async function reconcileMissing(deps: SyncDeps, walk: WalkResult, seen: Set<string>): Promise<number> {
  const { db, gateway, rootFolderId, clock } = deps;
  const treeFolders = new Set([rootFolderId, ...walk.items.filter((i) => i.mimeType === MIME.folder).map((i) => i.id)]);
  const now = () => clock.now().toISOString();
  let gone = 0;
  let goneFolders: string[] = [];

  for (const source of listTrackedSources(db)) {
    if (seen.has(source.file_id) || source.file_id === rootFolderId) continue;
    if (!source.parent_id || !walk.listedFolders.has(source.parent_id)) continue;

    let status: "unavailable" | "out_of_scope" | null = null;
    let reason = "";
    try {
      const item = await gateway.getItem(source.file_id);
      if (item.trashed) {
        status = "unavailable";
        reason = "Arquivo na lixeira do Drive.";
      } else if (!item.parents.some((p) => treeFolders.has(p))) {
        status = "out_of_scope";
        reason = "Arquivo movido para fora da pasta monitorada.";
      }
    } catch (error) {
      if (error instanceof DriveError && error.kind === "auth") throw error;
      if (error instanceof DriveError && (error.kind === "not_found" || error.kind === "forbidden")) {
        status = "unavailable";
        reason = "Arquivo removido do Drive ou sem acesso.";
      } else {
        continue; // falha temporária: não conclui nada sobre o arquivo
      }
    }
    if (status) {
      markGone(db, source.file_id, status, reason, now());
      gone++;
      if (source.kind === "folder") goneFolders.push(source.file_id);
    }
  }

  while (goneFolders.length > 0) {
    const next: string[] = [];
    for (const folderId of goneFolders) {
      for (const child of listTrackedChildren(db, folderId)) {
        if (seen.has(child.file_id)) continue;
        markGone(db, child.file_id, "unavailable", "A pasta que continha este arquivo ficou indisponível.", now());
        gone++;
        if (child.kind === "folder") next.push(child.file_id);
      }
    }
    goneFolders = next;
  }
  return gone;
}

function failureReason(error: unknown): string {
  if (error instanceof DriveError) return error.safeMessage;
  return "Não foi possível ler o conteúdo (arquivo inválido ou corrompido).";
}

function describeRunError(error: unknown): { code: string; message: string } {
  if (error instanceof DriveError) {
    if (error.kind === "auth") return { code: "auth", message: "Autorização do Google expirada ou revogada. Reconecte a conta." };
    return { code: "drive_unreachable", message: `Não foi possível ler o Google Drive: ${error.safeMessage}` };
  }
  if (error instanceof AppError) return { code: error.code, message: error.safeMessage };
  return { code: "unexpected", message: "Erro inesperado na sincronização. Detalhes no log do servidor." };
}
