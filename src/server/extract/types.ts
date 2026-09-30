export interface Section {
  heading: string;
  level: number;
  /** Linha (1-based) do título no texto normalizado. */
  line: number;
}

export interface TextExtract {
  kind: "text";
  /** Texto normalizado (NFC, LF). É contra ele que a evidência literal é conferida. */
  text: string;
  title: string | null;
  sections: Section[];
  /** Metadados `chave: valor` declarados no início do documento (ex.: `status: ativo`). */
  metadata: Record<string, string>;
}

export interface CellValue {
  /** Endereço da célula, ex.: `D2`. */
  address: string;
  text: string;
  raw: string | number | boolean | null;
  /** Data de calendário `AAAA-MM-DD`, quando a célula é data. */
  date?: string;
}

export interface SheetRow {
  rowNumber: number;
  /** Células indexadas pelo texto do cabeçalho da coluna. */
  cells: Record<string, CellValue>;
}

export interface Sheet {
  name: string;
  header: string[];
  rows: SheetRow[];
}

export interface SheetExtract {
  kind: "sheet";
  sheets: Sheet[];
}

export type Extracted = TextExtract | SheetExtract;
