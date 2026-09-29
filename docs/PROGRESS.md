# PROGRESS — Estado do projeto

> Documento canônico de continuidade. **Consulte antes de iniciar qualquer tarefa relevante** e atualize ao concluir cada marco.
> Última atualização: **2026-09-29 (terça), ~01h BRT — sessão encerrada a pedido do usuário para continuar mais tarde no mesmo dia.**

## Prazo

**Entrega: domingo, 2026-10-04, até 23h59 (horário de Brasília).**
- Enviar **no privado ao organizador** o **link do repositório** e o **diário de bordo**.
- Commits finais enviados ao GitHub.
- A conta `LunkiBR` precisa estar como **colaboradora** do repositório privado `LenziAI-DEV/liga-ia-central-atividades` (DEC-004).

## ▶ Como retomar (primeira coisa a fazer na próxima sessão)

1. `git checkout fase-1-drive && git pull`. A branch atual de trabalho é **`fase-1-drive`**: ainda **não** teve merge na `main`.
2. `npm install`, só se `node_modules` sumir. Depois, `npm test`: devem passar **100 testes**.
3. **Teste real da Fase 1 com o Google** (roteiro abaixo, pendência P-1). O `.env.local` **já está preenchido e validado** (conferido sem exibir valores).
4. Code review do diff da Fase 1 (P-2), registro no `VALIDACAO.md`, merge `fase-1-drive` → `main`.
5. Criar a branch `fase-2-painel` e seguir a Fase 2 do `docs/plans/IMPLEMENTATION_PLAN.md`.

### Roteiro do teste real da Fase 1 (P-1)

Critérios: CA-F1.1, F1.3, F1.4, F2.1–F2.3, F13.2.

1. Build e start. **Sempre encerrar o servidor pelo PID da porta**, nunca com `taskkill /IM node.exe` (DEC-010):
   ```bash
   npm run build && npx next start -p 3000
   ```
2. O usuário abre http://localhost:3000/sincronizacao e clica em **Conectar conta Google**. A tela "O Google não verificou este app" é normal no modo de teste: clicar em **Continuar** e aceitar o acesso somente leitura (CA-F13.2).
3. Esperado depois do retorno:
   - aviso "Conta Google conectada";
   - pasta `LIA case teste` com link;
   - **6 arquivos processados**, inclusive `Atas/Ata_2026-10-01.md` (CA-F2.1), com links que abrem no Drive;
   - "Último sucesso" no horário de Brasília (CA-F1.1).
4. "Sincronizar agora": o horário é atualizado e nada é reprocessado (CA-F1.4).
5. Opcional: subir um `.png` qualquer na pasta, sincronizar e ver "Formato ainda não processado" (CA-F2.2); depois apagar o arquivo.
6. Revogar o acesso em Conta Google › Segurança › Apps de terceiros › "LIA Central (dev)" › Remover acesso. Sincronizar → deve aparecer "reautorização necessária", com o inventário ainda visível (CA-F1.3). Reconectar em seguida.
7. Registrar o resultado observado no `docs/VALIDACAO.md` (seção Fase 1) e no diário.

**Se der erro no OAuth:**
- `redirect_uri_mismatch`: o URI cadastrado precisa ser exatamente `http://localhost:3000/api/auth/google/callback`.
- `?erro=pasta_inacessivel`: o ID da pasta ou a conta está errado.
- `?erro=state_invalido`: o app foi aberto por `127.0.0.1` em vez de `localhost`.

## Estado atual

- **Fase 0 — Fundação:** ✅ concluída, com merge na `main`.
- **Fase 1 — Drive conectado:** 🟡 **código completo e testado** (1.1–1.5, 100 testes, typecheck, lint e build limpos) na branch `fase-1-drive` (último commit `514db04`, enviado ao GitHub). **Falta só o teste real com o Google (P-1) e o code review (P-2).**
- **Cronograma:** **em dia.** O plano previa as Fases 0 e 1 para terça (09-29), e as duas estão prontas no começo da terça, faltando só a validação real.
- **Plano vigente:** `docs/plans/IMPLEMENTATION_PLAN.md` (DEC-009). Autonomia entre fases; branch por fase; commit e push por sub-marco; merge na `main` ao fim da fase.
- **Como rodar:** `npm install` → `npm run setup` → preencher o `.env.local` → `npm run app` → http://localhost:3000.

## Concluído

| Data | Item | Artefato |
|---|---|---|
| 2026-09-28 | Análise completa dos documentos da banca e dos dados fictícios | `docs/CASE_ANALYSIS.md` |
| 2026-09-28 | PRD com 13 features, critérios de aceitação e 13 cenários de validação; 17 decisões aprovadas; Q-1…Q-7 resolvidas (banca e usuário) | `docs/PRD.md` (v0.2) |
| 2026-09-28 | Arquitetura aprovada (DEC-007) com cortes de escopo (DEC-008) | `docs/ARCHITECTURE.md` |
| 2026-09-28 | Plano de implementação aprovado (DEC-009) | `docs/plans/IMPLEMENTATION_PLAN.md` |
| 2026-09-28 | Repositório **privado** criado; convite de colaboradora enviado a `LunkiBR` | https://github.com/LenziAI-DEV/liga-ia-central-atividades |
| 2026-09-29 | **Fase 0 — Fundação** (0.1–0.5): Next.js 16.3.6 + TS + Tailwind 4 + Vitest; SQLite `node:sqlite` validado em dev e build; migrações; env com zod; `npm run setup` e `data:clear`; logger com redação; datas no fuso de SP; casca da UI com as 6 áreas; contraste testado | DEC-010 |
| 2026-09-29 | **Fase 1 — código** (1.1–1.5): OAuth (state + PKCE, `drive.readonly`, tokens AES-256-GCM); `DriveGateway` real e falso; `walkTree`; `classifyFile`; extratores `.md`, `.xlsx` (leitor próprio, DEC-011) e Google Docs; `runSync` (idempotente, falha isolada, lixeira, sem acesso, fora da pasta, execução única); tela "Estado da sincronização"; faixa global | DEC-011, DEC-012; branch `fase-1-drive` |
| 2026-09-29 | Usuário preencheu o `.env.local` (Google + Anthropic). Validado: formatos corretos, arquivo fora do Git | B-1 e B-3 resolvidos do lado do usuário |

## Pendências (em ordem)

| # | Pendência | Responsável | Observação |
|---|---|---|---|
| **P-1** | **Teste real da Fase 1 com o Google** (roteiro acima) e registro no `VALIDACAO.md` | Assistente + usuário (clicar em Conectar e aceitar no navegador) | Primeira tarefa da próxima sessão |
| **P-2** | Code review do diff da Fase 1 (regra do plano §3.4) antes do merge | Assistente | `git diff main...fase-1-drive` |
| **P-3** | Merge `fase-1-drive` → `main`, marcar o M1 como `complete` no PRD §16 e atualizar este arquivo | Assistente | Depois de P-1 e P-2 |
| **P-4** | **Fase 2** (painel pessoal): personas, índice e registro vigente, importação da planilha, "Minhas" e "Todas" | Assistente | Meta: quarta 09-30 de manhã (está adiantada) |
| P-5 | Decidir sobre o hook GateGuard (liberar as pastas do projeto com `GATEGUARD_EXEMPT_GLOBS`, o que o próprio usuário configura) | Usuário | Opcional; hoje cada arquivo novo é bloqueado uma vez antes de ser criado |
| P-6 | Conferir se a `LunkiBR` aceitou o convite de colaboradora | Usuário/assistente (`gh api repos/LenziAI-DEV/liga-ia-central-atividades/collaborators`) | Antes da entrega |
| P-7 | Anotar para o README (Fase 10): Node ≥ 22.13; o npm 11 não roda scripts de instalação (só o `unrs-resolver` fica pendente, sem impacto); a tela "Google não verificou este app"; a expiração da autorização em 7 dias no modo de teste | Assistente | Fase 10 |
| P-8 | Reautorizar o Google no dia da demo (a autorização de teste expira em ~7 dias) | Usuário | Checklist pré-demo (Fase 10.4) |

## Próximas fases (plano §5)

| Dia | Data | Fases | Situação |
|---|---|---|---|
| Ter | 09-29 | 0, 1 | Fase 0 ✅ · Fase 1 🟡 (falta o teste real) |
| Qua | 09-30 | 2, 3, 4.1–4.3 | — (dá para começar a Fase 2 ainda na terça) |
| Qui | 10-01 | 4.4, 5, 6.0–6.3 | Chave da Anthropic ✅ já no `.env.local` |
| Sex | 10-02 | 6.4–6.6, 7 | — |
| Sáb | 10-03 | 8, 9 | — |
| Dom | 10-04 | 10 (entrega) | — |

## Blockers

Nenhum bloqueio técnico. B-1 (credenciais Google) e B-3 (chave Anthropic) resolvidos do lado do usuário em 2026-09-29. Só falta o clique de autorização no navegador (P-1).

## Riscos de prazo

- A política de corte está no plano §6 (pontos de controle: quarta e sexta à noite).
- O refresh token OAuth em modo Testing expira em 7 dias [GUIA §2]. **Reautorizar no dia da demo** (P-8).
- Datas dos dados fictícios: prazos de 10-05 a 10-11. Na entrega (10-04) nenhum estará vencido; se a avaliação for depois, aparecerão como vencidos (comportamento correto, [LEIA]).

## Notas operacionais

- **Encerrar o servidor de teste:** `netstat -ano | grep LISTENING | grep ":3000 "` → `taskkill //PID <pid> //T //F`. Nunca por nome de processo (DEC-010).
- **Hook GateGuard (plugin ECC):** bloqueia a primeira criação ou edição de cada arquivo até que os fatos sejam declarados. É esperado; basta declarar e repetir.
- **Documentação do Next 16:** consultar `node_modules/next/dist/docs/` antes de usar APIs do Next (`AGENTS.md`).
