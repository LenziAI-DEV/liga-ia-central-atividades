"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Aviso em texto quando o navegador perde a rede (CA-F12.5). O app roda local, mas o Drive e a IA precisam de rede. */
export function ConnectionStatus() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div role="status" className="mb-6 rounded-md border-l-4 border-[var(--warning-ink)] bg-[var(--warning-bg)] px-4 py-3 text-[var(--warning-ink)]">
      <strong>Sem conexão:</strong> o navegador está sem rede. O que já está na tela continua válido, mas a sincronização com o Drive e a análise da IA só voltam quando a conexão voltar.
    </div>
  );
}
