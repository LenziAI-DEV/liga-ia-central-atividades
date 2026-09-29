// Chamado uma vez quando o servidor Next.js inicia (docs: file-conventions/instrumentation).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { boot } = await import("./server/boot");
  boot();
}
