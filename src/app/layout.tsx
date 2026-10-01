import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import { ConnectionStatus } from "@/components/connection-status";
import { MainNav } from "@/components/main-nav";
import { PersonaSwitcher } from "@/components/persona-switcher";
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
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 rounded-md font-semibold text-[var(--primary)]">
              {/* Logo decorativa: o nome ao lado é o texto do link. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-96.png" alt="" width={32} height={32} className="size-8 rounded-md" />
              <span className="leading-tight">
                Central da Liga IA
                <span className="block text-xs font-normal text-[var(--text-muted)]">Protótipo local · dados fictícios</span>
              </span>
            </Link>
            <PersonaSwitcher />
          </div>
          <MainNav />
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <ConnectionStatus />
          <div className="mb-6 empty:hidden">
            <SyncBanner />
          </div>
          {children}
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-[var(--text-muted)] sm:px-6">
          <Link href="/como-decidimos" className="underline underline-offset-2">
            Como o app decide o valor oficial
          </Link>
        </footer>
      </body>
    </html>
  );
}
