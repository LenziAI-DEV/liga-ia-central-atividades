export type DriveErrorKind =
  | "auth" // token inválido/revogado: exige reautorização
  | "forbidden" // sem permissão para o item
  | "not_found" // item removido ou inacessível
  | "rate_limited" // cota: tentar de novo com espera
  | "transient" // rede/5xx: tentar de novo com espera
  | "too_large" // acima do limite de download/exportação
  | "not_downloadable" // Google Doc via download binário, etc.
  | "unknown";

/** Erro do Drive com mensagem segura para a interface (sem tokens nem URLs). */
export class DriveError extends Error {
  constructor(
    readonly kind: DriveErrorKind,
    readonly safeMessage: string,
    options?: { cause?: unknown },
  ) {
    super(safeMessage, options);
    this.name = "DriveError";
  }
}

export function isRetryableDriveError(error: unknown): boolean {
  return error instanceof DriveError && (error.kind === "rate_limited" || error.kind === "transient");
}
