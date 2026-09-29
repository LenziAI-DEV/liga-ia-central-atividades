# PROGRESS — Estado do projeto

> Documento canônico de continuidade. **Consulte antes de iniciar qualquer tarefa relevante** e atualize ao concluir cada marco.
> Última atualização: 2026-09-28 (segunda-feira).

## Prazo

**Entrega: domingo, 2026-10-04, até 23h59 (horário de Brasília).**
- Enviar **no privado ao organizador** o **link do repositório** e o **diário de bordo**.
- Commits finais enviados ao GitHub.
- A conta `LunkiBR` precisa estar como **colaboradora** do repositório privado `LenziAI-DEV/liga-ia-central-atividades` (DEC-004).

## Estado atual

**Fase:** requisitos concluídos. Próximo passo: planejamento de implementação do Marco 1 (`/plan docs/PRD.md`).
**Código:** nenhum. Repositório sem scaffolding e sem stack definida.

## Concluído

| Data | Item | Artefato |
|---|---|---|
| 2026-09-28 | Análise completa dos documentos da banca e dos dados fictícios | `docs/CASE_ANALYSIS.md` |
| 2026-09-28 | PRD com 13 features, critérios de aceitação e 13 cenários de validação | `docs/PRD.md` (v0.2) |
| 2026-09-28 | Aprovação das 17 decisões de produto (DN-01…DN-17) | `docs/PRD.md` §13 |
| 2026-09-28 | Documentação canônica criada (ARCHITECTURE, DECISIONS, PROGRESS) | `docs/` |

## Em andamento

- **Arquitetura — APROVADA em 2026-09-28 (DEC-007, cortes de escopo DEC-008):** `docs/ARCHITECTURE.md`, com 18 ADRs, desenhada pelo agente `ecc:architect` e revisada (marcas **[rev]**). Next.js + TypeScript em um processo; SQLite via `node:sqlite`; varredura do Drive a cada 60 s; OAuth `drive.readonly` com tokens cifrados; IA Claude Sonnet 5.5 atrás de `AiProvider` com validador determinístico.
- **M1 — plano em revisão:** `docs/plans/M1-pasta-conectada.plan.md` (será realinhado à arquitetura depois da aprovação).
- **Setup externo do usuário (em paralelo):** GitHub (feito pelo assistente com `gh` depois da aprovação), Google Cloud, pasta do Drive e chave Anthropic. Passo a passo entregue no terminal em 2026-09-28.
- Nenhum código escrito ainda.
- Ambiente verificado em 2026-09-28: Node 24.19, npm 11.17, git 2.55, gh 2.100 logado como `LenziAI-DEV`; `node:sqlite` funcional.

## Próximos passos

1. Resolver os pré-requisitos do usuário (abaixo), em paralelo ao planejamento.
2. `/plan` do Marco 1 (pasta conectada e fontes visíveis). O plano define a stack e registra a escolha em `DECISIONS.md` e `ARCHITECTURE.md`.
3. Começar o diário de bordo (entregável E-3) junto com o primeiro código.

## Cronograma proposto (marcos do PRD §16)

| Dia | Data | Marcos | Observação |
|---|---|---|---|
| Seg | 09-28 | — | Análise, PRD, plano do M1 |
| Ter | 09-29 | M1 Pasta conectada · M2 Atividades importadas | Depende do OAuth funcionando |
| Qua | 09-30 | M3 Gestão de atividades · M4 Sincronização automática | |
| Qui | 10-01 | M5 Autoridade e conflitos · início do M6 (IA) | Q-6 (provedor de IA) decidido antes |
| Sex | 10-02 | M6 Sugestões + revisão · M7 "O que mudou para mim" | |
| Sáb | 10-03 | M8 Comece aqui · M9 Experiência e acessibilidade | |
| Dom | 10-04 | M10 Pacote de entrega (README, validação, demo) | Folga final. **M11 (PDF) só se sobrar tempo** |

## Blockers e pendências

| # | Pendência | Depende de | Impacto |
|---|---|---|---|
| B-1 | Projeto Google Cloud + tela de consentimento OAuth + cliente Web + pasta de teste `LIA case teste` com os dados fictícios [GUIA §1–§6], [LEIA] | Usuário (conta Google própria) | Bloqueia o M1 |
| ~~B-2~~ | ~~Q-1 a Q-4 enviadas à banca~~ **Resolvido em 2026-09-28:** a banca confirmou DN-02, DN-03 e DN-06. A demo é ao vivo na máquina do candidato, com um arquivo fictício entregue pela Liga (ver PRD §14) | — | — |
| B-3 | Q-6: provedor de IA, chave de API e teto de custo | Usuário + protótipo | Bloqueia o M6 |

## Riscos de prazo

- 6 dias de implementação para 10 marcos. O corte de escopo segue a DEC-003: "menor e correto" e diferenciais por último.
- O refresh token OAuth em modo Testing expira em 7 dias [GUIA §2]. Uma autorização feita em 09-29 vence por volta de 10-06, perto da janela de avaliação. É preciso reautorizar antes da demo.
- Datas dos dados fictícios: prazos de 10-05 a 10-11. Na entrega (10-04) nenhum estará vencido; se a avaliação for depois, aparecerão como vencidos (comportamento correto, [LEIA]).
