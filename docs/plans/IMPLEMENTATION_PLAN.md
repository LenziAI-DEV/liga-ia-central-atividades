# Plano de implementação — Central de contexto e atividades

**Fontes:** `docs/PRD.md` (v0.2 aprovado) · `docs/ARCHITECTURE.md` (aprovada, DEC-007) · `docs/DECISIONS.md` (DEC-001…008) · `docs/PROGRESS.md` · `docs/CASE_ANALYSIS.md`
**Status:** aguardando aprovação do usuário
**Complexidade:** Large (≈ 50–55 h de implementação em 6 dias)
**Prazo:** domingo 2026-10-04, 23h59 BRT (DEC-003)
**Substitui:** `docs/plans/M1-pasta-conectada.plan.md` (rascunho anterior à arquitetura)

---

## 1. Requisitos em uma página

Construir, **rodando localmente**, uma central web que:

1. **Lê a pasta de teste do Drive**:
   - conexão OAuth só de leitura;
   - carga inicial recursiva de `.md`, `.xlsx` e Google Docs;
   - detecção automática de arquivos novos, editados, renomeados e removidos em ≤ 15 min (meta: ≤ 1 min);
   - estado de cada arquivo em texto (R01–R03).
2. **Importa as atividades** da planilha apontada pelo índice e passa a ser a **fonte oficial** delas:
   - visão pessoal por persona, filtros, criação e edição;
   - persistência e histórico auditável (R04–R06).
3. **Usa IA só para propor**:
   - atas viram sugestões com evidência literal, validadas deterministicamente e revisadas por humano;
   - hipóteses ficam de fora;
   - sem duplicatas (R07, R08).
4. **Protege a fonte oficial**: arquivo homônimo ou vazio, documento superado e conflitos nunca mudam nada em silêncio (R10).
5. **Responde "o que mudou para mim"** separando confirmadas, pendentes e incertas (R09).
6. **Orienta o membro novo** ("Comece aqui") sem inventar nada (R12).
7. **É acessível e responsiva**, com as 6 áreas nomeadas (R11).
8. **Chega com os entregáveis:** README, diário de bordo, registro de validação (V-1…V-13), demo de 5–8 min e declaração de uso de IA (E-1…E-7).

**Demo oficial (DEC-005):** ao vivo na máquina do candidato. A Liga entrega uma ata fictícia, que é colocada no Drive durante a apresentação.

---

## 2. Padrões a espelhar

**Não existe código no repositório (greenfield).** Os padrões são **criados na Fase 0** e seguidos a partir daí:

| Categoria | Padrão criado na Fase 0 | Origem |
|---|---|---|
| Nomes | Arquivos `kebab-case.ts`; tipos `PascalCase`; funções `camelCase`; código em inglês; textos da UI em pt-BR | ARCHITECTURE §5.3 |
| Estrutura | `src/app` (UI e rotas) → `src/server/<domínio>` (serviços) → portas (`Db`, `DriveGateway`, `AiProvider`, `Clock`) injetadas por `container.ts` | ARCHITECTURE §5.1 |
| Erros | `AppError`/`DriveError` tipados com `safeMessage`. A borda (action ou route) converte em texto para a UI. Falha nunca vira vazio | ADR-16, AR-16 |
| Logs | JSON por linha com redação de segredos (`observability/logger.ts`) | ADR-16 |
| Dados | Repositório por entidade, SQL parametrizado, `db.tx()` para escritas compostas | ADR-03 |
| Testes | Vitest com `*.test.ts` ao lado do código. Cenários em `tests/integration/vNN-*.test.ts`, com `FakeDriveGateway`, `RecordedProvider` e `Clock` fixo | ADR-17 |

---

## 3. Regras de execução (valem para todas as fases)

1. **Antes de cada fase:** reler `PROGRESS.md` e as seções do PRD e da ARCHITECTURE citadas na fase.
2. **TDD no domínio:** extratores, classificador, importador, validador, serviços e resolvedor ganham os testes antes do código (skill `tdd-workflow`). A UI é verificada por E2E (Fase 9) e manualmente.
3. **Definição de pronto de um sub-marco:**
   - `npm run typecheck`, `npm run lint` e `npm test` verdes;
   - critérios de aceitação (CA-*) do sub-marco verificados;
   - commit com mensagem descritiva e push.
4. **Definição de pronto de uma fase:**
   - demo da fase executada (roteiro na própria fase);
   - `PROGRESS.md` atualizado;
   - entrada no `DIARIO_DE_BORDO.md` (E-3);
   - linhas preenchidas no `VALIDACAO.md` (E-4);
   - decisões novas registradas em `DECISIONS.md`;
   - `code-review` do diff da fase;
   - marco marcado `complete` no PRD §16.
5. **Nada acoplado ao pacote de teste (RNF-7):** cada teste de cenário tem uma variante com IDs, nomes de arquivo e datas trocados.
6. **Segredos:** nunca em código, log, commit nem chat. `git grep` de padrões de segredo antes de cada push de fim de fase.
7. **Corte de escopo** quando atrasar: ver §6.

---

## 4. Fases e sub-marcos

Legenda: 🟦 obrigatório da banca · 🟨 decisão nossa · 🟩 opcional. **Demo** = o que dá para mostrar ao fim. **Verifica** = como provar.

### Fase 0 — Fundação do projeto
**Quando:** terça 09-29, manhã (≈ 3 h) · **Depende de:** nada · **PRD:** transversal · **ARCH:** ADR-02, ADR-03, ADR-16, ADR-18

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 0.1 | Scaffold | Next.js (App Router, TS strict, Tailwind 4, ESLint, `src/`), gerado em pasta temporária e movido para a raiz (o `create-next-app` não aceita a raiz atual por causa de `docs/` e `dados_ficticios/`). `engines.node >= 22.13`, `.nvmrc` (24), Vitest, zod. Scripts `dev`, `build`, `start`, `app`, `test`, `typecheck`, `lint` | `npm run build` e `npm test` verdes |
| 0.2 | **Spike do SQLite** (risco RT-A) | `db/client.ts`: `node:sqlite` via `process.getBuiltinModule`, WAL, `foreign_keys`, `busy_timeout`, API `Db {get, all, run, tx}`. Rota `/api/health` lê o banco | Funciona em `next dev` **e** em `next build && next start`. Se falhar → better-sqlite3 e nova DEC |
| 0.3 | Migrações e config | `migrate.ts` (SQL numerado, idempotente), `001_core.sql` (settings, oauth, members, sources, source_contents, source_versions, sync_runs). `config/env.ts` (zod; lista só os **nomes** que faltam). `.env.example`. `scripts/setup.mjs` (cria `.env.local` e gera `APP_ENCRYPTION_KEY`). `scripts/clear-data.mjs` | A migração aplicada 2× não quebra. `npm run setup` gera a chave. Env ausente mostra mensagem legível |
| 0.4 | Infra transversal | `logger` + `redact` (com testes), `Clock` + `lib/datetime.ts` (America/Sao_Paulo, data pura, "vencido"), `AppError`, `container.ts`, `instrumentation.ts` (só migra, por enquanto) | Testes de redação e de data (serial `.5`, fuso) |
| 0.5 | Casca da UI | `layout.tsx` com a navegação das **6 áreas** (CA-F12.1), tokens de marca (`--lia-blue`, `--lia-cyan`), foco visível, `force-dynamic`, páginas vazias com estado "em construção" | Abrir `/` e navegar pelo teclado |

**Demo da fase:** `npm run setup && npm run app` → a primeira tela mostra as 6 áreas, e `/api/health` responde `db: ok`.

---

### Fase 1 — Drive conectado e inventário de fontes (PRD Marco 1)
**Quando:** terça 09-29, tarde (≈ 7 h) · **Depende de:** Fase 0; **B-1** (credenciais Google e pasta) só para a verificação real · **PRD:** F1, F2, F13 · **ARCH:** ADR-04/06/07, §6.1–6.3, §7.1

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 1.1 | OAuth | `auth/crypto.ts` (AES-256-GCM), `token-store.ts`, `google-oauth.ts` (state + PKCE, `access_type=offline`, `prompt=consent`), rotas `start`, `callback` e `disconnect`. Checagem de escopo e de pasta no callback. Host canônico. `invalid_grant` → `reauth_required` | Testes de cifra (inclusive chave errada). **Manual:** conectar, ver a conta e a pasta, desconectar. A tela de consentimento pede só leitura (CA-F13.2) |
| 1.2 | Gateway do Drive | `DriveGateway` (Google e Fake), `retry.ts` (backoff com jitter), `DriveError`, `walkTree` (BFS, paginação, visitados, `listedFolders`), `classifyFile` (MIME + extensão; atalho não seguido) | Testes: 3 páginas, 2 níveis, pasta repetida, atalho, `.png`/`.docx` → "formato ainda não processado" (CA-F2.2) |
| 1.3 | Extratores | `markdown.ts` (texto, títulos, seções, metadados `chave: valor`), `xlsx.ts` (**leitor próprio**, DEC-011, no lugar do exceljs; abas, cabeçalho, linhas, endereço de célula, datas → `AAAA-MM-DD`), export de Google Docs `text/markdown` com fallback `text/plain` (em `sync/extract-source.ts`), `normalize.ts` + `contentHash` | Fixtures reais: 4 linhas com prazos 2026-10-05, 06, 09 e 11. A planilha vazia tem aba `Ata` e 0 linhas. `status: ativo`/`deprecated` lidos |
| 1.4 | SyncService (manual e inicial) | `sync-service.ts`: lease em `sync_runs`, execução única, upsert por `file_id`, `version` como gatilho e hash como chave, falha isolada, verificação de sumiço só sob pastas listadas (`files.get`: lixeira, sem acesso ou fora da árvore), expurgo do conteúdo em cache, contagens | Testes com Fake: idempotência (CA-F3.5), falha isolada (CA-F2.3), rename sem reprocessar (CA-F3.3), lixeira → `unavailable` (CA-F3.4), listagem parcial não remove nada |
| 1.5 | UI "Estado da sincronização" | `/sincronizacao`: conexão e conta, pasta (nome e link), texto do escopo, último sucesso e última tentativa, contagens, tabela acessível de fontes (estado **em texto**, motivo, link), "Sincronizar agora" (action), faixa global de estado no layout. O polling em `/api/sync/status` passou para a Fase 4 (DEC-012.5) | Teclado e foco. Estados vazio, carregando, erro e reautorização |

**Demo da fase (Drive real):** conectar a conta → carga inicial → aparecem os 6 arquivos, inclusive `Atas/Ata_2026-10-01.md`, com links que abrem no Drive → "Sincronizar agora" atualiza o horário → revogar o acesso na Conta Google → aparece "reautorização necessária" e o inventário continua visível.
**Critérios:** CA-F1.1–F1.4, CA-F2.1–F2.3, CA-F13.2.

---

### Fase 2 — Atividades importadas e painel pessoal (PRD Marco 2)
**Quando:** quarta 09-30, manhã (≈ 5 h) · **Depende de:** Fase 1 · **PRD:** F4.2, F5, F11 · **ARCH:** ADR-08, ADR-11, §6.4

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 2.1 | Personas | `config/members.json` (seed dos 4 fictícios, papel e aliases), `persona/current-persona.ts` (cookie), `PersonaSwitcher` (form nativo, funciona pelo teclado e sem JS), persona ativa sempre em texto | Trocar de persona não grava nenhum evento (CA-F5.2) |
| 2.2 | Índice e registro vigente | `authority/index-parser.ts` + `classifier.ts` (ADR-11, parte que localiza o registro): resolve "fonte das atividades" → **exatamente um** `file_id` e a aba. Zero ou vários → pendência visível e nada importado | Testes com o índice real e com uma variante (outro nome e outra aba) |
| 2.3 | Importação inicial | `002_activities.sql` (activities, owners, references, events append-only com triggers, id_sequences, registry_imports), `registry-importer.ts` (mapa de cabeçalhos, responsáveis por nome ou alias com nome desconhecido → "a confirmar", status pt-BR → enum, data pura, ID preservado, eventos `imported`, referências `imported_from` e `historical_origin`) | `v01`: Ana {101, 104}, Davi {102, 104}, Carla {103}. Total = 4. ACT-103 bloqueada. Variante com IDs trocados |
| 2.4 | Painéis | `/` (6 áreas e as próximas atividades da persona com prazo, M-7 ≤ 1 clique), `/minhas-atividades` (não concluídas, compartilhadas, ordenadas por prazo, destaques de bloqueada e sem prazo), `/atividades` (filtros GET: responsável, frente, estado, prazo, minhas), componentes `StatusBadge`, `DueDate` ("a definir", "vencido"), `ActivityCard`/`ActivityTable` | CA-F5.1–F5.6. Largura de 375 px mantém dono, prazo e estado |

**Demo da fase:** como Ana → ACT-101 e ACT-104; trocar para Davi → ACT-102 e ACT-104; filtrar "Operações" → 2 atividades; "Todas" = 4.
**Critérios:** V-1, CA-F2.4, CA-F5.1–F5.6, CA-F11.1.

---

### Fase 3 — Gestão de atividades com histórico (PRD Marco 3)
**Quando:** quarta 09-30, tarde (≈ 4 h) · **Depende de:** Fase 2 · **PRD:** F6 · **ARCH:** §5.1 (só o `ActivityService` escreve), §8.3

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 3.1 | ActivityService | `create`, `update` (patch com `expectedVersion`), concluir e bloquear, eventos antes→depois na mesma transação, IDs `LIA-000n` (DN-15), `origin=manual` | Testes: evento por mudança, controle otimista, tentativa de UPDATE/DELETE em evento é abortada |
| 3.2 | Telas | `/atividades/nova`, `/atividades/[id]` (campos, prioridade e notas DN-16, referências com links, histórico, avisos), `/atividades/[id]/editar`, ações rápidas "Concluir" e "Bloquear". Erros por campo em texto. PRG | CA-F6.1–F6.4. `v06` (fechar e reabrir o banco) |

**Demo da fase:** como Davi, criar "Testar persistência" sem prazo → editar o estado → **reiniciar o app** → a atividade continua lá, com autor, horário e histórico.
**Critérios:** V-6, CA-F6.1–F6.4.

---

### Fase 4 — Sincronização automática (PRD Marco 4)
**Quando:** quarta 09-30, noite, e quinta 10-01, manhã (≈ 4 h) · **Depende de:** Fase 1 · **PRD:** F3 · **ARCH:** ADR-05, §6.3, §6.9

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 4.1 | Scheduler | `sync/scheduler.ts` via `instrumentation.ts`: guard em `globalThis`, `NEXT_RUNTIME`/`NEXT_PHASE`, 1ª execução ~5 s após o boot, intervalo de 60 s, backoff até 5 min, pausa em `reauth_required`, "já em execução" agregando o gatilho manual, recuperação de lease vencido | Teste com `register()` chamado 2× (um scheduler só). Log mostra ciclos regulares |
| 4.2 | Estados de desatualização | "Potencialmente desatualizado" derivado (falha atual ou último sucesso há mais de 2× o intervalo) na faixa global e nas atividades | `v08b` (offline) e `v08c` (revogado) |
| 4.3 | Detalhe da fonte | `/fontes/[fileId]`: estado, motivo, versões (`source_versions`), datas (primeira detecção × modificação × processamento, para cronometrar M-3) | Visual |
| 4.4 | Validação com o Drive real | Enviar `Ata_2026-10-04.md` sem clicar em nada; subir `Ata_2026-10-03.docx`, convertê-la para Google Docs e remover o `.docx`; editar o Doc; renomear um arquivo; mandar um para a lixeira | V-2 (sem IA), V-3, V-8 cronometrados no `VALIDACAO.md` |

**Demo da fase:** com o app aberto e **sem clicar**, um arquivo novo no Drive aparece como processado em ≤ 1 min. Uma edição vira nova versão sem fonte duplicada. Um arquivo na lixeira fica "indisponível".
**Critérios:** CA-F3.1–F3.6, V-3, V-8.

---

### Fase 5 — Autoridade e conflitos (PRD Marco 5)
**Quando:** quinta 10-01, manhã (≈ 3 h) · **Depende de:** Fase 2 · **PRD:** F4 · **ARCH:** ADR-11, ADR-12

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 5.1 | Classificação completa | Classes `direcao_ativo`, `direcao_parcial`, `registro_vigente`, `ata`, `historico` e `sem_autoridade` + `possibleConflict`, com motivos calculados (ex.: "não apontado pelo índice", "aba `Ata` ≠ `Atividades`", "0 registros"). Exibidas na tabela de fontes e no detalhe | `v05` (homônimo vazio: snapshot idêntico) e `v13` (documento superado) |
| 5.2 | Precedência visível | `precedence-resolver.ts` (`official`, `pending[]`, `conflicts[]`, `staleness`), `PRECEDENCE_RULE_TEXT` (a mesma fonte para a UI e o README), página `/como-decidimos`, link a partir de toda pendência e todo conflito | Testes do resolvedor (os conflitos são testados de novo na Fase 6, quando existirem sugestões). CA-F4.3 |

**Demo da fase:** enviar `Ata - copia vazia.xlsx` → as 4 atividades não mudam → a fonte aparece "sem autoridade / possível conflito" com os motivos → `PLANO_EDITORIAL_ANTIGO.md` aparece como "histórico — substituído por GUIA_INICIAL.md".
**Critérios:** V-5, V-13, CA-F4.1–F4.3.

---

### Fase 6 — IA: sugestões com evidência e revisão humana (PRD Marco 6)
**Quando:** quinta 10-01, tarde, e sexta 10-02, manhã (≈ 10 h) · **Depende de:** Fases 2, 3 e 5; **B-3** (chave da Anthropic) · **PRD:** F7, F8, RN-8 · **ARCH:** ADR-09, §6.5, §6.6, §7.2 · **DEC-006** (Sonnet 5.5)

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 6.0 | **Spike do modelo** | Consultar a documentação atual do SDK (skill `claude-api`, TypeScript). Script que chama `claude-sonnet-5-5` com Structured Outputs nas 3 atas do pacote. Medir tokens e custo. Calibrar `effort` | JSON válido nas 3 atas. Custo por ata registrado. Primeira anotação para E-7 no diário |
| 6.1 | AiProvider | `ai/provider.ts`, `anthropic-provider.ts` (Structured Outputs; thinking adaptativo com `effort` baixo; checagem de `stop_reason` incluindo `refusal`; timeout de 120 s; erros tipados), `recorded-provider.ts`, `disabled-provider.ts`, `ai_calls` (tokens e custo, **sem conteúdo**) | Testes com `RecordedProvider` e `DisabledProvider` |
| 6.2 | Validador | `hints.ts` + `validator.ts` com as **11 regras** da §6.5: esquema, campos permitidos, evidência literal, alvo mencionado, datas inequívocas, responsáveis conhecidos e presentes na evidência, frente incerta, hipótese → `no_action`, "confirma o oficial", dedupe, possível relação (DN-17). `dedupe.ts` | Um teste por regra, com saídas sintéticas ruins: data inventada, Bruno como responsável, injeção, evidência inexistente |
| 6.3 | AnalysisService | `003_ai.sql` (document_analyses, suggestions, suggestion_fields, suggestion_evidence, ai_calls). Fila pós-sync com trava própria, `waiting_registry`, até 3 tentativas + "Tentar novamente", `stale` → `substituida` quando a fonte é editada, resumo do documento. Prompt `extract-v1` com o documento delimitado por nonce | `v02`, `v03` (sugestões antigas stale), `v07`, `v11`, `v12` com respostas gravadas |
| 6.4 | Revisão | `suggestion-service.ts` (aceitar, ajustar e aceitar, rejeitar com motivo obrigatório; `UPDATE … WHERE pendente`; comparação com o valor atual; papel checado no servidor), `ActivityService.applyFromSuggestion`. Telas `/sugestoes` e `/sugestoes/[id]` (evidência, link, data do documento, atual → proposto, incertezas, frente). Aviso "atualização pendente" nas atividades | `v04`: 1 update em ACT-101, oficial inalterado até o aceite, aceite do Bruno gera evento e referências à planilha e à ata, novo aceite → `already_reviewed`. CA-F8.1–F8.5 |
| 6.5 | Diferença do registro (DN-02, resposta da banca à Q-3) | `registry-diff.ts`: nova versão do `.xlsx` vigente → sugestões `origin=registry_diff`; linha ausente → aviso, nada apagado | Teste: editar o prazo no xlsx → sugestão; remover uma linha → aviso |
| 6.6 | Gravação de fixtures | Gravar as respostas reais do modelo em `tests/fixtures/ai/` (para testes sem rede nem custo). Atas extras: "até sexta", injeção, dono desconhecido, decisão e hipótese na mesma frase | Suíte completa verde sem rede |

**Demo da fase (Drive real):** enviar `Ata_2026-10-03` (Google Doc) → sugestão de prazo em ACT-101 com o trecho literal e o link → ACT-101 continua com 05/10 e o aviso de pendência → como Bruno, aceitar → 07/10 e o histórico aponta para a planilha e a ata. Depois, `Ata_2026-10-04.md` → sugestão de criar tarefa para a Carla (frente incerta, possível relação com ACT-103) e **nenhuma** tarefa para a ideia "talvez".
**Critérios:** V-2, V-4, V-7, V-11, V-12, CA-F7.1–F7.7, CA-F8.1–F8.5.

---

### Fase 7 — "O que mudou para mim" e Novidades (PRD Marco 7)
**Quando:** sexta 10-02, tarde (≈ 3 h) · **Depende de:** Fase 6 · **PRD:** F9 · **ARCH:** ADR-10, §6.7

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 7.1 | ChangeFeed | `004_personas.sql` (`persona_visits`), `feed/change-feed.ts` (`forPersona`: confirmadas, pendentes, incertas/conflito, bloqueadas e vencendo; `documents`: novos, alterados, indisponíveis, reclassificados, com o resumo de IA rotulado). Sem LLM | `v09`: Ana vê a pendência e Davi não; depois do aceite, "confirmadas"; persona sem mudanças → "Nada mudou para você desde…" |
| 7.2 | Tela | `/novidades`: marco = última visita (lido antes de gravar) ou período (`?desde=`), três grupos com links, estado vazio | CA-F9.1–F9.5 |

**Demo da fase:** Ana e Davi abrem "o que mudou" e veem resumos diferentes, com fonte e estado de aprovação.
**Critérios:** V-9.

---

### Fase 8 — "Comece aqui" determinístico (PRD Marco 8, DEC-008)
**Quando:** sábado 10-03, manhã (≈ 3 h) · **Depende de:** Fases 2 e 5 · **PRD:** F10 · **ARCH:** ADR-13 (versão sem IA), §6.8

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 8.1 | OnboardingService | Propósito e frentes com **trechos literais** dos documentos `direção` e o rótulo "provisório / a confirmar" quando `status: parcial` (com `responsavel_por_confirmar`). Regras só de documentos `direção — ativo`. Históricos listados à parte com "substituído por". Fonte das atividades (arquivo, aba, data da importação e "desde a importação, o oficial é esta aplicação"). Primeira ação da persona, ou "Você ainda não tem atividades atribuídas" | `v10` (Davi, Bruno). `v13` (a regra antiga não aparece) |
| 8.2 | Tela | `/comece-aqui` com 3 a 4 passos e links. Destaque na primeira tela | CA-F10.1–F10.3 |

**Demo da fase:** alguém que não conhece a Liga acha, sem ajuda, o propósito (marcado como provisório), as 3 frentes, a fonte das tarefas e a primeira ação.
**Critérios:** V-10.

---

### Fase 9 — Experiência, acessibilidade e E2E (PRD Marco 9)
**Quando:** sábado 10-03, tarde (≈ 5 h) · **Depende de:** Fases 1–8 · **PRD:** F12 · **ARCH:** ADR-14, ADR-17

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 9.1 | Acabamento visual | Hierarquia editorial, marca aplicada com contraste verificado (pares registrados), estados vazio, carregando, erro e conexão perdida em todas as telas, revisão da largura de 375 px | Registro dos pares de contraste ≥ 4,5:1 (CA-F12.2). Escala de cinza (CA-F12.4) |
| 9.2 | Playwright + axe | 4 a 6 testes com `DRIVE_MODE=fake` e `AI_PROVIDER=recorded`: 6 áreas na primeira tela; troca de persona pelo teclado; criar atividade → erro em texto → salvar → **reiniciar o servidor** → persiste; aceitar sugestão só pelo teclado; axe sem violações; viewport de 375 px | `npm run test:e2e` verde (CA-F12.1, F12.3, F5.6) |
| 9.3 | 🟩 Opcionais (DEC-008) | Síntese por IA no "Comece aqui" (ADR-13), modo "Drive local" (ADR-15), Google Sheets nativo (OD-07). **Só se as Fases 0–9.2 estiverem verdes** | Decisão registrada |

**Demo da fase:** o fluxo inteiro feito só com o teclado e no celular (viewport estreito).

---

### Fase 10 — Pacote de entrega (PRD Marco 10)
**Quando:** domingo 10-04 (≈ 5 h + folga) · **Depende de:** tudo · **PRD:** §12 (E-1…E-7)

| # | Sub-marco | Entregas | Verifica |
|---|---|---|---|
| 10.1 | README | Todos os itens do E-2: arquitetura simples, fonte oficial e precedência (texto de `PRECEDENCE_RULE_TEXT`), passo a passo de Google Cloud e pasta, instalação e execução, sincronização (intervalo, falhas, renomeado, removido), formatos, escopo monitorado, **custo medido por uso**, limitações, "Antes de usar dados reais", limpeza de cache e revogação, ferramentas de IA usadas | Checklist E-2 item a item. **Teste de instalação limpa** (clonar numa pasta nova e seguir só o README), M-9 |
| 10.2 | Registro de validação | `docs/VALIDACAO.md` completo: V-1…V-13 com entrada, esperado, observado e correções, e tempos de detecção medidos (M-3) | Os casos de conflito, dado ausente e arquivo novo presentes (E-4) |
| 10.3 | Diário e declaração de IA | `docs/DIARIO_DE_BORDO.md` revisado, com a **decisão alterada depois de uma saída incorreta do modelo** (E-7). Versão para enviar no privado | E-3, E-7 |
| 10.4 | Roteiro da demo | Roteiro de 5–8 min (Drive → detecção → sugestão → revisão → criação manual → "o que mudou") + checklist pré-demo (reautorizar OAuth, app rodando, pasta preparada, ata extra à mão para ensaio) | Ensaio cronometrado |
| 10.5 | Entrega | Varredura final de segredos, push final, confirmar que a `LunkiBR` aceitou o convite, **enviar no privado o link e o diário** | E-1 |
| 10.6 | 🟩 PDF com texto (M11) | Só se sobrar tempo | — |

---

## 5. Cronograma e dependências externas

| Dia | Fases | Pré-requisito externo (usuário) |
|---|---|---|
| Seg 09-28 (noite) | Aprovação do plano | — |
| Ter 09-29 | 0, 1 | **B-1:** Google Cloud + pasta, para a demo da Fase 1 (o código avança com o Drive falso) |
| Qua 09-30 | 2, 3, 4.1–4.3 | Enviar arquivos ao Drive na 4.4 (eu guio) |
| Qui 10-01 | 4.4, 5, 6.0–6.3 | **B-3:** chave da Anthropic no `.env.local` (antes da 6.0) |
| Sex 10-02 | 6.4–6.6, 7 | — |
| Sáb 10-03 | 8, 9 | Teste "membro novo sem orientação" (idealmente outra pessoa) |
| Dom 10-04 | 10 | Enviar link + diário no privado até 23h59 |

```text
F0 ─► F1 ─► F2 ─► F3 ─┐
        └──► F4 ──────┤
             F2 ─► F5 ┴─► F6 ─► F7
             F2+F5 ─► F8
F1..F8 ─► F9 ─► F10
```

---

## 6. Política de corte (se atrasar)

**Pontos de controle:** fim de quarta (Fases 0–4 verdes?) e fim de sexta (Fase 7 verde?). Cortar **nesta ordem**, registrando cada corte em `DECISIONS.md`:

1. 9.3 opcionais e 10.6 PDF;
2. E2E reduzido de 6 para 3 testes (mantendo persistência com reinício, teclado e axe);
3. 6.5 diferença do registro simplificada: só o aviso "planilha editada — N diferenças", com a lista das diferenças, sem virar sugestão revisável;
4. 4.3 detalhe da fonte simplificado (vira uma coluna na tabela).

**Nunca cortar:** R01–R12, o validador da IA, a idempotência, a proteção contra homônimo e os entregáveis E-1…E-7.

---

## 7. Riscos do plano

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| `node:sqlite` falha no bundler do Next (RT-A) | Média | Alto | É o 1º spike (0.2), com o fallback pronto |
| B-1 (Google Cloud) atrasar | Média | Alto | Drive falso permite avançar as Fases 1–3. A demo real é feita quando B-1 fechar |
| OAuth em Testing expira em 7 dias (RT-D) | Alta | Alto | Reautorizar no dia da demo (checklist 10.4). A UI mostra a data de expiração |
| Qualidade da IA nas armadilhas (RT-G) | Média | Alto | O validador é a autoridade. O spike 6.0 cedo. Fixtures adversariais |
| A Fase 6 estourar as 10 h | Média | Alto | Corte 3 da §6. Começar o 6.0 na quinta de manhã |
| Scheduler duplicado no `next dev` (RT-B) | Média | Médio | Guard + lease + teste |
| Ata inesperada da banca com formato diferente | Média | Alto | A banca garantiu o "mesmo formato e padrão das atas" (DEC-005). Variantes de teste (RNF-7) |
| Cansaço e prazo | Alta | Alto | Sub-marcos pequenos com commit. Pontos de controle na quarta e na sexta. Política de corte |

---

## 8. Validação (comandos do projeto, criados na Fase 0)

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # vitest: unidade + integração (Drive falso, IA gravada, sem rede)
npm run test:e2e         # playwright + axe (a partir da Fase 9)
npm run build            # next build
npm run app              # next build && next start → http://localhost:3000
git grep -nE "GOCSPX|ya29\.|1//0|sk-ant" -- . ':!docs'   # varredura de segredos
```

## 9. Aceitação do plano completo

- [ ] Fases 0–10 concluídas, ou cortes registrados conforme a §6
- [ ] V-1…V-13 no `VALIDACAO.md` com resultado observado
- [ ] R01–R12 demonstráveis (M-2) e E-1…E-7 entregues
- [ ] `PROGRESS.md`, `DIARIO_DE_BORDO.md` e `DECISIONS.md` atualizados em cada fase
- [ ] Link do repositório e diário enviados no privado até 2026-10-04 23h59
