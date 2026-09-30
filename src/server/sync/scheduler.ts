export interface CycleResult {
  status: string;
}

export interface SchedulerOptions {
  intervalMs: number;
  /** Teto do intervalo depois de falhas seguidas (preserva os 15 min da banca, F3.1). */
  maxBackoffMs: number;
  /** Espera até o primeiro ciclo depois de iniciar. */
  firstDelayMs: number;
  runCycle: () => Promise<CycleResult>;
  onCycle?: (result: CycleResult | { status: "error"; error: unknown }, info: { failures: number; nextInMs: number }) => void;
  now?: () => number;
}

export interface SchedulerStatus {
  running: boolean;
  lastCycleAt: number | null;
  lastStatus: string | null;
  consecutiveFailures: number;
}

/**
 * Repetição sem sobreposição: o próximo ciclo só é agendado depois que o atual termina.
 * Falha (ou exceção) dobra o intervalo até o teto; qualquer outro resultado volta ao
 * intervalo normal. Não conhece Drive nem banco: recebe o ciclo pronto (ADR-05).
 */
export function createScheduler(options: SchedulerOptions) {
  const now = options.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let failures = 0;
  let lastCycleAt: number | null = null;
  let lastStatus: string | null = null;

  function schedule(delayMs: number) {
    timer = setTimeout(cycle, delayMs);
    timer.unref?.();
  }

  async function cycle() {
    timer = null;
    if (!running) return;
    let result: CycleResult | { status: "error"; error: unknown };
    try {
      result = await options.runCycle();
    } catch (error) {
      result = { status: "error", error };
    }
    lastCycleAt = now();
    lastStatus = result.status;
    failures = result.status === "failed" || result.status === "error" ? failures + 1 : 0;
    const delay = failures === 0 ? options.intervalMs : Math.min(options.intervalMs * 2 ** failures, options.maxBackoffMs);
    options.onCycle?.(result, { failures, nextInMs: delay });
    if (running) schedule(delay);
  }

  return {
    /** Idempotente: chamar duas vezes não cria um segundo temporizador. */
    start() {
      if (running) return;
      running = true;
      schedule(options.firstDelayMs);
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    status(): SchedulerStatus {
      return { running, lastCycleAt, lastStatus, consecutiveFailures: failures };
    },
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;

const globals = globalThis as unknown as { __liaScheduler?: Scheduler };

/** Um agendador por processo, mesmo se o módulo for reavaliado (HMR) ou `register()` rodar de novo (RT-B). */
export function ensureScheduler(build: () => Scheduler): Scheduler {
  globals.__liaScheduler ??= build();
  globals.__liaScheduler.start();
  return globals.__liaScheduler;
}

export function getScheduler(): Scheduler | undefined {
  return globals.__liaScheduler;
}

/** Só para testes. */
export function resetSchedulerForTests() {
  globals.__liaScheduler?.stop();
  globals.__liaScheduler = undefined;
}
