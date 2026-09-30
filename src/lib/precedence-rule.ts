/**
 * Regra única de precedência (F4.1, F4.7, DN-03). É a mesma fonte para a interface
 * (`/como-decidimos`) e para o README (Fase 10): mude aqui e os dois acompanham.
 */
export const PRECEDENCE_RULE_TEXT: readonly { title: string; text: string }[] = [
  {
    title: "1. Decisão humana registrada no app",
    text: "Uma edição manual, ou uma sugestão aceita ou ajustada por um revisor, define o valor oficial atual da atividade. Toda decisão fica no histórico, com autor e horário.",
  },
  {
    title: "2. Importação inicial do registro apontado pelo índice",
    text: "O valor oficial de partida vem da planilha que o índice do acervo aponta como fonte das atividades. O app não escolhe “a planilha mais recente”, nem pela data nem pelo nome.",
  },
  {
    title: "3. Proposta de ata nova, ainda pendente",
    text: "Não muda o valor oficial. Ela só gera o aviso “atualização pendente” na atividade, até um revisor decidir. É assim que o app lê a ordem do índice: a proposta tem precedência de exibição, não de valor.",
  },
  {
    title: "4. Documentos de direção",
    text: "O índice, o estado atual e o guia definem contexto e orientação de quem chega, mas não valores de atividade.",
  },
  {
    title: "5. Documentos superados, rascunhos e planilhas sem autoridade",
    text: "Nunca anulam um registro oficial. Ficam acessíveis como histórico, ou marcados como “sem autoridade / possível conflito”, com o motivo à vista.",
  },
  {
    title: "6. Duas fontes ativas que discordam, sem decisão humana",
    text: "Geram um conflito visível, com links para as duas fontes. O valor oficial não muda até alguém decidir.",
  },
];

export const PRECEDENCE_SUMMARY =
  "O valor oficial de uma atividade só muda por decisão humana registrada no app. Documentos novos apenas geram propostas; na dúvida, o app mostra o problema e pede uma decisão, em vez de escolher sozinho.";
