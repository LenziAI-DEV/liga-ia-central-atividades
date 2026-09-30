import type { PromptActivity } from "@/server/ai/prompts/extract-v1";
import type { ValidatorActivity } from "@/server/ai/validator";

/** As 4 atividades oficiais da carga inicial, como o modelo e o validador as veem. */
export const OFFICIAL_ACTIVITIES: Array<PromptActivity & ValidatorActivity> = [
  { id: "ACT-101", title: "Preparar carrossel sobre ferramentas", owners: ["Ana"], ownerIds: ["ana"], dueDate: "2026-10-05", status: "em_andamento", nextStep: "Preparar roteiro e selecionar exemplos", front: "Growth" },
  { id: "ACT-102", title: "Montar checklist inicial de onboarding", owners: ["Davi"], ownerIds: ["davi"], dueDate: "2026-10-06", status: "a_fazer", nextStep: "Revisar material de entrada e propor primeira versão", front: "Operações" },
  { id: "ACT-103", title: "Elaborar briefing de oficina", owners: ["Carla"], ownerIds: ["carla"], dueDate: "2026-10-09", status: "bloqueada", nextStep: "Obter confirmação do espaço", front: "Formação" },
  { id: "ACT-104", title: "Revisar fluxo de solicitação de materiais", owners: ["Ana", "Davi"], ownerIds: ["ana", "davi"], dueDate: "2026-10-11", status: "a_fazer", nextStep: "Mapear etapas atuais", front: "Operações" },
];

/** Documentos gravados por `ai:record`: rótulo → caminho (a partir de `dados_ficticios/` ou de `tests/fixtures/ai/docs/`). */
export const RECORDED_DOCS: Array<{ label: string; path: string; kind: "data" | "synthetic" }> = [
  { label: "ata_2026-10-01", path: "01_CARGA_INICIAL/Ata_2026-10-01.md", kind: "data" },
  { label: "ata_2026-10-03", path: "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-03.md", kind: "data" },
  { label: "ata_2026-10-04", path: "02_ADICIONAR_DEPOIS_DA_CARGA/Ata_2026-10-04.md", kind: "data" },
  { label: "ata_ate_sexta", path: "ata_ate_sexta.md", kind: "synthetic" },
  { label: "ata_injecao", path: "ata_injecao.md", kind: "synthetic" },
  { label: "ata_dono_desconhecido", path: "ata_dono_desconhecido.md", kind: "synthetic" },
  { label: "ata_decisao_e_hipotese", path: "ata_decisao_e_hipotese.md", kind: "synthetic" },
];
