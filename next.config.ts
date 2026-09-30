import type { NextConfig } from "next";

/** Cabeçalhos de proteção em todas as respostas (docs: next-config-js/headers). */
const SECURITY_HEADERS = [
  // Não pode ser embutido em iframe de outro site (clickjacking em "Desconectar").
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Endereços internos (ex.: ?erro=…) não vão para sites externos no Referer.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // O E2E gera o build em .next-e2e para não atrapalhar o app em execução.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
