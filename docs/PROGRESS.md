# PROGRESS — Estado do projeto

> Documento canônico de continuidade. **Consulte antes de iniciar qualquer tarefa relevante** e atualize ao concluir cada marco.
> Última atualização: 2026-09-29 (terça-feira), fim da Fase 0.

## Prazo

**Entrega: domingo, 2026-10-04, até 23h59 (horário de Brasília).**
- Enviar **no privado ao organizador** o **link do repositório** e o **diário de bordo**.
- Commits finais enviados ao GitHub.
- A conta `LunkiBR` precisa estar como **colaboradora** do repositório privado `LenziAI-DEV/liga-ia-central-atividades` (DEC-004).

## Estado atual

**Fase:** Fase 0 (fundação) **concluída**. Próximo passo: **Fase 1 — Drive conectado e inventário de fontes** (branch `fase-1-drive`).
**Plano vigente:** `docs/plans/IMPLEMENTATION_PLAN.md` (aprovado, DEC-009). Autonomia entre fases; branch por fase; commit e push por sub-marco.
**Como rodar hoje:** `npm install` → `npm run setup` → `npm run app` → http://localhost:3000 (6 áreas; `/api/health`).

## Concluído

| Data | Item | Artefato |
|---|---|---|
| 2026-09-28 | Análise completa dos documentos da banca e dos dados fictícios | `docs/CASE_ANALYSIS.md` |
| 2026-09-28 | PRD com 13 features, critérios de aceitação e 13 cenários de validação; 17 decisões aprovadas | `docs/PRD.md` (v0.2) |
| 2026-09-28 | Arquitetura aprovada (DEC-007) com cortes de escopo (DEC-008) | `docs/ARCHITECTURE.md` |
| 2026-09-28 | Plano de implementação aprovado (DEC-009) | `docs/plans/IMPLEMENTATION_PLAN.md` |
| 2026-09-28 | Repositório **privado** criado; convite de colaboradora enviado a `LunkiBR` (permissão *write*, pendente de aceite) | https://github.com/LenziAI-DEV/liga-ia-central-atividades |
| 2026-09-29 | **Fase 0 — Fundação** (0.1–0.5): Next.js 16.3.6 + TS + Tailwind 4 + Vitest; SQLite via `node:sqlite` validado em dev e build; migrações; env com zod; `npm run setup` e `npm run data:clear`; logger com redação; datas no fuso de São Paulo; casca da UI com as 6 áreas e paleta testada (contraste). 41 testes verdes | DEC-010; `docs/DIARIO_DE_BORDO.md`; `docs/VALIDACAO.md` |

## Em andamento

- Fase 1 (a iniciar): OAuth, gateway do Drive, extratores, SyncService, tela "Estado da sincronização".

## Próximos passos

1. **Fase 1** (1.1 a 1.5) com Drive falso e testes. Depois, **teste real** com as credenciais do usuário no `.env.local` (B-1).
2. Fase 2 (quarta de manhã): personas, índice, importação e painéis.

## Cronograma (plano §5)

| Dia | Data | Fases | Situação |
|---|---|---|---|
| Ter | 09-29 | 0, 1 | Fase 0 ✅ |
| Qua | 09-30 | 2, 3, 4.1–4.3 | — |
| Qui | 10-01 | 4.4, 5, 6.0–6.3 | Precisa da `ANTHROPIC_API_KEY` no `.env.local` |
| Sex | 10-02 | 6.4–6.6, 7 | — |
| Sáb | 10-03 | 8, 9 | — |
| Dom | 10-04 | 10 (entrega) | — |

## Blockers e pendências

| # | Pendência | Depende de | Impacto |
|---|---|---|---|
| B-1 | Google Cloud e pasta **prontos** (usuário, 2026-09-28). Falta **preencher o `.env.local`** (já criado pelo `npm run setup`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DRIVE_TEST_FOLDER_ID` | Usuário | Bloqueia só o teste real da Fase 1 |
| B-3 | `ANTHROPIC_API_KEY` no `.env.local` | Usuário | Bloqueia a Fase 6.0 (quinta) |
| B-4 | Convite de colaboradora `LunkiBR` aguardando aceite | Organizador | Não bloqueia; conferir antes da entrega |

## Riscos de prazo

- 6 dias de implementação para 10 fases. Política de corte no plano §6 (pontos de controle: quarta e sexta à noite).
- O refresh token OAuth em modo Testing expira em 7 dias [GUIA §2]. **Reautorizar no dia da demo.**
- Datas dos dados fictícios: prazos de 10-05 a 10-11. Na entrega (10-04) nenhum estará vencido; se a avaliação for depois, aparecerão como vencidos (comportamento correto, [LEIA]).
