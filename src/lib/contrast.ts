/** Paleta da interface. Os mesmos valores estão em `src/app/globals.css`. */
export const PALETTE = {
  liaBlue: "#1433BD",
  liaBlueDark: "#0E2690",
  liaCyan: "#19DCE3",
  liaCyanSoft: "#E6FBFC",
  ink: "#111827",
  inkMuted: "#4B5563",
  paper: "#FFFFFF",
  paperAlt: "#F5F7FB",
  okInk: "#166534",
  okBg: "#DCFCE7",
  warnInk: "#92400E",
  warnBg: "#FEF3C7",
  dangerInk: "#991B1B",
  dangerBg: "#FEE2E2",
} as const;

type Color = keyof typeof PALETTE;

/** Pares texto/fundo usados na interface — todos precisam de contraste ≥ 4,5:1 (WCAG 2.2, CA-F12.2). */
export const TEXT_PAIRS: ReadonlyArray<{ text: Color; background: Color; use: string }> = [
  { text: "ink", background: "paper", use: "texto principal" },
  { text: "inkMuted", background: "paper", use: "texto secundário" },
  { text: "inkMuted", background: "paperAlt", use: "texto secundário em faixas" },
  { text: "liaBlue", background: "paper", use: "links e títulos de marca" },
  { text: "paper", background: "liaBlue", use: "botão primário" },
  { text: "paper", background: "liaBlueDark", use: "botão primário (hover)" },
  { text: "ink", background: "liaCyan", use: "destaque ciano (texto escuro)" },
  { text: "ink", background: "liaCyanSoft", use: "fundo de aviso informativo" },
  { text: "liaBlue", background: "liaCyanSoft", use: "link em aviso informativo" },
  { text: "okInk", background: "okBg", use: "estado concluído/ok" },
  { text: "warnInk", background: "warnBg", use: "estado pendente/atenção" },
  { text: "dangerInk", background: "dangerBg", use: "estado bloqueado/erro" },
];

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
