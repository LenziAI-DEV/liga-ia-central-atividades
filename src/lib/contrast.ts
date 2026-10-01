/** Paleta da interface. Os mesmos valores estão em `src/app/globals.css` (docs/DESIGN_SYSTEM.md). */
export const PALETTE = {
  primary: "#32439B",
  primaryHover: "#28367F",
  primarySoft: "#EDEFFA",
  onPrimary: "#FFFFFF",
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceMuted: "#ECEEF6",
  borderStrong: "#7C84A0",
  text: "#151A2D",
  textMuted: "#525A73",
  successInk: "#166534",
  successBg: "#DCFCE7",
  warningInk: "#8A4B08",
  warningBg: "#FDF1D3",
  errorInk: "#991B1B",
  errorBg: "#FEE2E2",
} as const;

type Color = keyof typeof PALETTE;

/** Pares texto/fundo usados na interface — todos precisam de contraste ≥ 4,5:1 (WCAG 2.2, CA-F12.2). */
export const TEXT_PAIRS: ReadonlyArray<{ text: Color; background: Color; use: string }> = [
  { text: "text", background: "surface", use: "texto principal" },
  { text: "text", background: "bg", use: "texto principal sobre o fundo da página" },
  { text: "textMuted", background: "surface", use: "texto secundário" },
  { text: "textMuted", background: "bg", use: "texto secundário sobre o fundo da página" },
  { text: "textMuted", background: "surfaceMuted", use: "texto secundário em faixas" },
  { text: "primary", background: "surface", use: "links e títulos de marca" },
  { text: "primary", background: "bg", use: "links sobre o fundo da página" },
  { text: "primary", background: "primarySoft", use: "link e item ativo em área suave" },
  { text: "onPrimary", background: "primary", use: "botão primário" },
  { text: "onPrimary", background: "primaryHover", use: "botão primário (hover)" },
  { text: "text", background: "primarySoft", use: "fundo de aviso informativo" },
  { text: "successInk", background: "surface", use: "texto de sucesso" },
  { text: "warningInk", background: "surface", use: "texto de atenção" },
  { text: "errorInk", background: "surface", use: "texto de erro" },
  { text: "successInk", background: "successBg", use: "estado concluído/ok" },
  { text: "warningInk", background: "warningBg", use: "estado pendente/atenção" },
  { text: "errorInk", background: "errorBg", use: "estado bloqueado/erro" },
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
