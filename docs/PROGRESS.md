# PROGRESS — Estado do projeto

> Documento canônico de continuidade. **Consulte antes de iniciar qualquer tarefa relevante** e atualize ao concluir cada marco.
> Última atualização: **2026-10-05 (segunda, manhã) — dia da apresentação (12h30). Todas as fases entregues; app preparado para a demo (banco limpo, Google reconectado) e defeito de "Documentos analisados" corrigido (DEC-027). Faltam só os passos do usuário (ver Pendências).**

## Prazo

**Entrega: domingo, 2026-10-04, até 23h59 (horário de Brasília).**
- Enviar **no privado ao organizador** o **link do repositório** e o **diário de bordo**.
- Commits finais enviados ao GitHub.
- A conta `LunkiBR` precisa estar como **colaboradora** do repositório privado `LenziAI-DEV/liga-ia-central-atividades` (DEC-004). **Convite aceito (P-6).**

## ▶ Como retomar (primeira coisa a fazer na próxima sessão)

1. `git checkout main` e criar a branch da próxima fase (a `main` contém as Fases 1 a 4).
2. `npm test` (esperado: **313 testes** + 7 de gravação pulados), `npm run typecheck`, `npm run lint`.
3. **Ler `docs/AI_EXECUTION_POLICY.md`** (DEC-014: Sonnet + Medium por padrão, MODEL ROUTING antes de tarefas relevantes, sem santa-loop rotineiro).
4. As pendências de teste manual (V-3 com IA e diferença do registro) foram concluídas em 2026-09-30 (DEC-021). Fase 7 entregue (DEC-022, 331 testes). Fase 8 entregue (DEC-023, 340 testes). Fases 7+8 auditadas (DEC-024, 348 testes). Fase 9 entregue (DEC-025, 352 testes + 8 E2E). Redesign do frontend entregue (DEC-026, 354 testes + 8 E2E). Próximo: **Fase 10**.

**Como rodar:** `npm install` → `npm run setup` → preencher o `.env.local` → `npm run app` → http://localhost:3000.
- O servidor escuta **só em 127.0.0.1** (DEC-013).
- Aberto por `127.0.0.1`, o app leva para `localhost`.
- Qualquer outro host recebe 403.

## Estado atual

- **Fase 0 — Fundação:** ✅ concluída, com merge na `main`.
- **Fase 1 — Drive conectado:** ✅ **concluída, verificada e mesclada na `main`** (2026-09-30). Marco 1 `complete`.
  - **Teste real com o Google:** CA-F1.1, F1.3, F1.4, F2.1 e F13.2 conferidos pelo log e pelo banco (`VALIDACAO.md`).
  - **Auditoria completa:** revisão de código, segurança (segredos, `npm audit`, cabeçalhos, host) e 3 rodadas de revisão adversarial (santa-loop). Achados e correções na DEC-013.
  - **Números:** 165 testes; 85% de cobertura de `src/server` + `src/lib`; typecheck, lint e build limpos; Lighthouse (acessibilidade) 100.
- **Cronograma:** **meio dia de atraso** em relação ao plano. A auditoria consumiu a tarde e a noite de terça. A Fase 2 começa na quarta de manhã, como previsto, sem sobra.
- **Plano vigente:** `docs/plans/IMPLEMENTATION_PLAN.md` (DEC-009).

## Concluído

| Data | Item | Artefato |
|---|---|---|
| 2026-09-28 | Análise completa dos documentos da banca e dos dados fictícios | `docs/CASE_ANALYSIS.md` |
| 2026-09-28 | PRD com 13 features, critérios de aceitação e 13 cenários de validação; 17 decisões aprovadas; Q-1…Q-7 resolvidas | `docs/PRD.md` (v0.2) |
| 2026-09-28 | Arquitetura aprovada (DEC-007) com cortes de escopo (DEC-008) | `docs/ARCHITECTURE.md` |
| 2026-09-28 | Plano de implementação aprovado (DEC-009) | `docs/plans/IMPLEMENTATION_PLAN.md` |
| 2026-09-28 | Repositório **privado** criado; convite de colaboradora enviado a `LunkiBR` | https://github.com/LenziAI-DEV/liga-ia-central-atividades |
| 2026-09-29 | **Fase 0 — Fundação** (0.1–0.5) | DEC-010 |
| 2026-09-29 | **Fase 1 — código** (1.1–1.5): OAuth, gateway do Drive, extratores, `runSync`, tela "Estado da sincronização" | DEC-011, DEC-012 |
| 2026-09-29 | **Teste real da Fase 1 com o Google** (P-1): conexão, carga, "Sincronizar agora", revogação e reconexão | `VALIDACAO.md` |
| 2026-09-29 | **Auditoria da Fase 1** (P-2): code review, varredura de segurança, santa-loop em 3 rodadas, correções com TDD (100 → 165 testes), QA de navegador, página 404 em português | DEC-013, `.claude/reviews/fase-1-review.md` |
| 2026-09-29 | GateGuard: pastas do projeto liberadas pelo usuário (`GATEGUARD_EXEMPT_GLOBS`) | P-5 resolvida |

| 2026-09-30 | **Redesign do frontend** (tokens, IBM Plex, logo, abas, lista densa, revisão de sugestão em duas colunas); QA de navegador e revisão por agentes | DEC-026, `docs/DESIGN_SYSTEM.md` |
| 2026-09-30 | **Fase 10 — pacote de entrega** (10.1 a 10.4): README completo, registro de validação fechado, diário com declaração de IA (E-7), roteiro da demo; instalação limpa testada; varredura de segredos limpa | `README.md`, `docs/DEMO.md`, `docs/VALIDACAO.md`, `docs/DIARIO_DE_BORDO.md` |
| 2026-10-05 | **Preparação da demo:** `.env.local` (debounce 0, sync 30 s), banco limpo, Google reconectado, carga inicial conferida (6 processados, 4 atividades, personas ok); **correção** de "Documentos analisados" que escondia análises concluídas (`error_code` nulo); 355 testes, typecheck e lint limpos | DEC-027 |

## Pendências (em ordem)

| # | Pendência | Responsável | Observação |
|---|---|---|---|
| ~~P-3~~ | ~~Corrigir os 3 MEDIUM da 4ª rodada e fazer o merge~~ | Assistente | ✅ 2026-09-30: corrigidos com teste (170 testes), `verification-loop` verde, merge feito. LOW da 4ª rodada seguem como dívida menor (lista na DEC-013): `[m]`/`[mm]` virando data; colisão da chave `#E`; abas repetidas relidas; `ENETUNREACH` sem retry; erro de rede no `exchangeCode`; texto "veja a tabela" no aviso parcial; "Desconectar" em `reauth_required`; UTF-8 com BOM + byte inválido; cerca mais curta; `forceRefreshOnFailure`; comentário do exceljs em `lib/datetime.ts` |
| **P-4** | **Fase 2** (painel pessoal): personas, índice e registro vigente, importação da planilha, "Minhas" e "Todas" | Assistente | Meta: quarta 09-30 |
| ~~P-6~~ | ~~A `LunkiBR` aceitar o convite de colaboradora~~ | — | **Resolvida em 2026-10-02:** convite reenviado e aceito; permissão `write` conferida pela API |
| ~~P-7~~ | ~~Anotar para o README~~ | — | **Feita** na Fase 10 (README completo) |
| ~~P-8~~ | ~~Reautorizar o Google no dia da demo~~ | — | ✅ 2026-10-05: reconectado após `data:clear`; sincronização real ok (7 vistos, 6 processados, 0 falhas) |
| P-9 | Itens adiados pela auditoria (DEC-013, "Adiado de propósito") | Assistente | Com o scheduler (Fase 4): corrida de reconexão, lease, backoff, falha permanente. Na Fase 9: tabela a 375 px, confirmação em "Desconectar" |
| P-10 | Ensaio cronometrado da demo com `docs/DEMO.md` (pasta e banco limpos) | Usuário | Checklist pré-demo |
| P-11 | **(prazo vencido em 2026-10-04 23h59; confirmar se foi enviado)** Enviar no privado ao organizador o link do repositório e o diário de bordo (`docs/DIARIO_DE_BORDO.md`) até 2026-10-04, 23h59 | Usuário | E-1 |
| P-12 | Conferência manual com teclado e leitor de tela (V-14) | Usuário | Opcional |

## Próximas fases (plano §5)

| Dia | Data | Fases | Situação |
|---|---|---|---|
| Ter | 09-29 | 0, 1 | ✅ Fase 0 · ✅ Fase 1 (auditada e mesclada) |
| Qua | 09-30 | 2, 3, 4.1–4.3 | Próximo passo |
| Qui | 10-01 | 4.4, 5, 6.0–6.3 | Chave da Anthropic ✅ já no `.env.local` |
| Sex | 10-02 | 6.4–6.6, 7 | — |
| Sáb | 10-03 | 8, 9 | — |
| Dom | 10-04 | 10 (entrega) | — |

## Blockers

Nenhum.

## Riscos de prazo

- Meio dia de atraso. A política de corte está no plano §6 (pontos de controle na quarta e na sexta à noite).
- O refresh token OAuth em modo Testing expira em 7 dias [GUIA §2]. **Reautorizar no dia da demo** (P-8).
- Datas dos dados fictícios: prazos de 10-05 a 10-11. Na entrega (10-04) nenhum estará vencido. Se a avaliação for depois, aparecerão como vencidos, o que é o comportamento correto [LEIA].

## Notas operacionais

- **Encerrar o servidor de teste:** `netstat -ano | grep LISTENING | grep ":3000 "` → `taskkill //PID <pid> //T //F`. Nunca por nome de processo (DEC-010).
- **Hook GateGuard (plugin ECC):** `src/`, `tests/`, `docs/`, `scripts/` e `e2e/` estão liberados. Arquivos da raiz e da pasta temporária da sessão ainda pedem os fatos na primeira edição.
- **Substituições com `sed` ou `perl` no Git Bash:** `\u` na substituição vira "próxima letra maiúscula". Para caracteres especiais, usar `String.fromCharCode` no código (ex.: `BOM` em `extract/normalize.ts`).
- **Documentação do Next 16:** consultar `node_modules/next/dist/docs/` antes de usar APIs do Next (`AGENTS.md`). O Next normaliza `127.0.0.1` para `localhost` em `nextUrl` e em redirecionamentos (DEC-013).
