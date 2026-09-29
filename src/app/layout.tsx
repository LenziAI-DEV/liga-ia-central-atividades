import type { Metadata } from "next";
import Link from "next/link";
import { MainNav } from "@/components/main-nav";
import { SyncBanner } from "@/components/sync-banner";
import "./globals.css";

// Dados vêm do banco local a cada requisição; nada é pré-renderizado (ADR-02).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Central da Liga IA UFSCar", template: "%s · Central da Liga IA" },
  description: "Central de contexto e atividades da Liga IA UFSCar — protótipo local com dados fictícios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <header className="border-b border-[var(--line)] bg-[var(--paper)]">
          <div className="mx-auto max-w-6xl px-4 pt-4 pb-3 sm:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <Link href="/" className="font-serif text-xl font-semibold text-[var(--lia-blue)]">
                Central da Liga IA
              </Link>
              <p className="text-sm text-[var(--ink-muted)]">Protótipo local · dados fictícios</p>
            </div>
            <MainNav />
          </div>
          <div aria-hidden="true" className="h-1 bg-[var(--lia-cyan)]" />
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-6 empty:hidden">
            <SyncBanner />
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
