/** As 6 áreas que o primeiro acesso precisa deixar explícitas ([CASE p8], CA-F12.1). */
export interface Area {
  href: string;
  label: string;
  description: string;
}

export const AREAS: readonly Area[] = [
  {
    href: "/comece-aqui",
    label: "Comece aqui",
    description: "Propósito, frentes, regras de trabalho, documentos principais e sua primeira ação.",
  },
  {
    href: "/minhas-atividades",
    label: "Minhas atividades",
    description: "O que é seu, com prazo, próximo passo e fonte.",
  },
  {
    href: "/atividades",
    label: "Todas as atividades",
    description: "Painel da Liga com filtros por responsável, frente, estado e prazo.",
  },
  {
    href: "/sugestoes",
    label: "Sugestões para revisar",
    description: "Propostas da IA a partir das atas, com evidência, aguardando decisão humana.",
  },
  {
    href: "/novidades",
    label: "Novidades dos documentos",
    description: "O que mudou para você e nos documentos desde a sua última visita.",
  },
  {
    href: "/sincronizacao",
    label: "Estado da sincronização",
    description: "Pasta conectada, última sincronização e estado de cada arquivo.",
  },
];

export function getArea(href: string): Area {
  const area = AREAS.find((a) => a.href === href);
  if (!area) throw new Error(`Área desconhecida: ${href}`);
  return area;
}
