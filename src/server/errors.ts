/**
 * Erro de domínio com mensagem segura para exibir ao usuário (sem segredos nem
 * detalhes internos). A borda (route handler / server action) mostra `safeMessage`.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
    options?: { cause?: unknown },
  ) {
    super(safeMessage, options);
    this.name = "AppError";
  }
}

export function toSafeMessage(
  error: unknown,
  fallback = "Erro inesperado. Detalhes técnicos foram registrados no log do servidor.",
): string {
  return error instanceof AppError ? error.safeMessage : fallback;
}
