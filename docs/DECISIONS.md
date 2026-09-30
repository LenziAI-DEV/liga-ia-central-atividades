# DECISIONS — Registro de decisões técnicas

> Documento canônico. Cada decisão técnica relevante entra aqui com contexto, alternativas e motivo.
> As **decisões de produto** (DN-01…DN-17) ficam em `docs/PRD.md` §13 e **não são duplicadas aqui**. Este registro só as referencia.
> Formato: `DEC-nnn` · data · status (`proposta` | `aceita` | `substituída por DEC-xxx`).

---

## DEC-001 — Documentação canônica e continuidade entre sessões
- **Data:** 2026-09-28 · **Status:** aceita (instrução do usuário)
- **Contexto:** o projeto vai atravessar várias sessões de trabalho com IA. O histórico de conversa se perde ou é resumido.
- **Decisão:** os documentos em `docs/` são a fonte de verdade, nesta ordem de consulta:
  - `PRD.md`: o que construir e por quê;
  - `ARCHITECTURE.md`: arquitetura vigente;
  - `DECISIONS.md`: decisões técnicas e motivos;
  - `PROGRESS.md`: estado, próximos passos e blockers.

  `CASE_ANALYSIS.md` é a análise-base dos documentos da banca (snapshot de 2026-09-28). `CLAUDE.md`, na raiz, aponta para esses documentos no início de cada sessão.
- **Regras:**
  - consultar os documentos aplicáveis antes de cada tarefa relevante;
  - atualizar o `PROGRESS.md` e os documentos afetados ao concluir cada marco;
  - se o histórico da conversa divergir de um documento mais recente, vale o documento.
- **Consequência:** este registro complementa, e não substitui, o **diário de bordo** exigido pela banca (entregável E-3), que tem tom narrativo e é voltado à avaliação.

## DEC-002 — Decisões de produto aprovadas
- **Data:** 2026-09-28 · **Status:** aceita
- **Decisão:** DN-01…DN-17 aprovadas pelo usuário ("aceito todas as recomendações"). O conteúdo está em `docs/PRD.md` §13.
- **Destaques com impacto técnico:**
  - DN-01: a base própria é a fonte oficial das atividades, e o Drive é só leitura;
  - DN-02: edição posterior do xlsx vira sugestões de diferença;
  - DN-03: precedência;
  - DN-07: extração determinística + IA com validação;
  - DN-08: detecção em ≤ 5 min;
  - DN-12: dedupe de sugestões;
  - DN-13: prazo como data pura.

## DEC-003 — Prazo de entrega e política de corte de escopo
- **Data:** 2026-09-28 · **Status:** aceita
- **Contexto:** o usuário confirmou a entrega em **2026-10-04 (domingo), 23h59 BRT**. Isso resolve a Q-7 do PRD.
- **Decisão:** seguir a ordem de marcos do PRD §16. Se faltar tempo, cortar nesta ordem:
  1. M11 (PDF, diferencial);
  2. polimentos visuais do M9 que não afetem acessibilidade obrigatória;
  3. nada do núcleo R01–R12 nem dos entregáveis E-1…E-7.
- **Motivo:** [CASE p10]: "uma solução menor que resolve corretamente os fluxos centrais pode ser melhor avaliada".

## DEC-004 — Repositório GitHub: nome, visibilidade e conteúdo
- **Data:** 2026-09-28 · **Status:** aceita (respostas do usuário Q-A, Q-B, Q-C)
- **Decisão:**
  - repositório `liga-ia-central-atividades` na conta `LenziAI-DEV`;
  - **privado durante o desenvolvimento**, tornado **público no dia da entrega**, depois de uma varredura de segredos (a banca recebe só o link);
  - **incluir** `dados_ficticios/` (necessários para testar [CASE p3]);
  - **não versionar** os PDFs de `instrucoes_iniciais/`: material da banca, e o repositório será público. A pasta entra no `.gitignore`, e os documentos citam os PDFs pelo nome.
- **Observação:** a criação do repositório só acontece depois da aprovação da arquitetura.
- **Emenda (2026-09-28, orientação do organizador no grupo do case):**
  - adicionar a conta **`LunkiBR`** como **colaboradora** do repositório;
  - até 2026-10-04 23h59, enviar **no privado** ao organizador o **link do repositório** e o **diário de bordo**;
  - deixar todos os commits finais enviados ao GitHub.

  Com o acesso por colaboradora, **o repositório pode continuar privado**. Tornar público deixa de ser necessário, e a varredura de segredos antes da entrega continua obrigatória.

## DEC-005 — Respostas da banca (Q-1 a Q-4) incorporadas
- **Data:** 2026-09-28 · **Status:** aceita
- **Contexto:** a banca respondeu pelo WhatsApp (texto repassado pelo usuário, registrado em `PRD.md` §14).
- **Decisão / consequências técnicas:**
  - **Demo:** roda localmente na máquina do candidato, com as credenciais Google e a pasta do candidato. A Liga entrega um arquivo fictício no padrão das atas, e ele é adicionado à pasta ao vivo. A arquitetura prioriza **detectar e processar rápido uma ata nova** (Markdown ou Google Doc). Não é preciso suportar formatos arbitrários.
  - **O README continua reproduzível** para terceiros ([CASE p3, p9]), mas a banca não depende de configurar o próprio OAuth para avaliar.
  - DN-02 (diferenças do xlsx para revisão), DN-03 (proposta pendente não altera o oficial) e DN-06 (revisor para todas as frentes) foram confirmadas.

## DEC-006 — Modelo de IA: Claude Sonnet 5.5
- **Data:** 2026-09-28 · **Status:** aceita (escolha do usuário; resolve a Q-6)
- **Decisão:** Anthropic **Claude Sonnet 5.5**, model ID exato `claude-sonnet-5-5` (sem sufixo de data), pelo SDK oficial da linguagem escolhida.
- **Fatos verificados** (documentação da API, cache de 2026-09-25):
  - US$ 2 / 1M tokens de entrada, US$ 10 / 1M de saída; leitura de cache US$ 0,20;
  - contexto de 1M tokens, saída de até 128K.
- **Restrições de uso que a implementação deve respeitar:**
  - saída JSON por **Structured Outputs** (`output_config.format` / `messages.parse()` com schema). `tool_choice` forçado (`any`/`tool`) e *assistant prefill* retornam 400 neste modelo;
  - `thinking: {type: "disabled"}` retorna 400. Usar thinking adaptativo com `effort` baixo ou médio para extração, ou `{type: "between_tools"}`;
  - checar `stop_reason: "refusal"` antes de ler o conteúdo. Avaliar o fallback server-side (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`);
  - toda saída continua validada contra o schema **e** contra o texto-fonte (ESP §6, PRD F7.6).
- **Custo:** estimativa preliminar de ~US$ 0,01–0,03 por ata processada (entrada de alguns milhares de tokens: ata, atividades e membros; saída de ~1K). **Medir no M6** e registrar no README (PRD M-10).
- **Alternativas:** Claude Opus 5.5 (US$ 4 / US$ 20, mais caro e desnecessário para extração curta); Claude Haiku 4.5 (US$ 1 / US$ 5, mais barato, mas o usuário preferiu o Sonnet 5.5 pela qualidade).

## DEC-007 — Arquitetura aprovada (ADR-01…ADR-18)
- **Data:** 2026-09-28 · **Status:** aceita ("aprovo a arquitetura e os 3 pontos do escopo da proposta")
- **Decisão:** vale `docs/ARCHITECTURE.md`. Os ADRs **não são copiados** aqui; a referência canônica é o próprio documento. Resumo:

| ADR | Decisão |
|---|---|
| ADR-01 | Monólito modular num único processo local |
| ADR-02 | Next.js (App Router) + TypeScript |
| ADR-03 | SQLite via `node:sqlite` (wrapper `Db`; fallback better-sqlite3) |
| ADR-04 | Varredura completa da árvore a cada 60 s, mais "Sincronizar agora" |
| ADR-05 | Scheduler in-process via `instrumentation.ts`, com guard e lease |
| ADR-06 | `version` do Drive como gatilho; SHA-256 do conteúdo normalizado como chave |
| ADR-07 | OAuth web server + PKCE, `drive.readonly`, tokens AES-256-GCM; conexão do operador separada da persona |
| ADR-08 | Troca explícita de persona (cookie); papel de revisor checado no servidor |
| ADR-09 | Pistas determinísticas → Claude Sonnet 5.5 (Structured Outputs) → validador determinístico; análise desacoplada do sync |
| ADR-10 | "O que mudou para mim" sem LLM; resumo de documento por IA |
| ADR-11 | Classificação de autoridade determinística (índice e metadados) |
| ADR-12 | `activities` só com o valor oficial; pendências e conflitos derivados |
| ADR-13 | "Comece aqui": ver DEC-008 |
| ADR-14 | Server Components, formulários nativos, Tailwind, sem biblioteca de componentes |
| ADR-15 | Modo "Drive local": ver DEC-008 |
| ADR-16 | Observabilidade: log JSON com redação, `sync_runs`, `ai_calls`, `/api/health` |
| ADR-17 | Vitest (Drive falso e IA gravada) + Playwright/axe + `ai:eval` opcional |
| ADR-18 | Execução local via npm, sem Docker no núcleo |

- **Substitui** as decisões DEC-004…011 **propostas** no rascunho do plano do M1, que nunca foram aceitas.

## DEC-008 — Cortes de escopo aprovados na arquitetura
- **Data:** 2026-09-28 · **Status:** aceita
- **Decisão:**
  1. **"Comece aqui" (ADR-13):** implementar primeiro a **versão determinística**, com trechos literais dos documentos de direção, os rótulos "provisório / a confirmar" e os dados do banco. A síntese por IA com citação validada fica **opcional**, só se sobrar tempo no sábado (M8/M9).
  2. **Modo "Drive local" (ADR-15):** **só se sobrar tempo**. Fora do caminho crítico.
  3. **Testes de interface (Playwright + axe, ADR-17):** **mantidos**, com 4 a 6 testes. São a evidência de acessibilidade e de persistência depois de reiniciar.
- **Motivo:** DEC-003 ("menor e correto") e prazo de 2026-10-04.

## DEC-009 — Plano de implementação e forma de trabalho
- **Data:** 2026-09-28 · **Status:** aceita ("aprovo o plano, P2 opção a, P3 opção a")
- **Decisão:**
  - vale `docs/plans/IMPLEMENTATION_PLAN.md` (Fases 0–10);
  - **Autonomia:** o assistente avança de fase em fase sem pedir aprovação a cada uma. Só para quando precisar do usuário (credenciais, arquivos no Drive, decisões) e envia um relatório curto no fim de cada fase;
  - **Git:** uma branch por fase (`fase-N-<nome>`), com commit e push a cada sub-marco e merge na `main` ao fim da fase, para a `main` estar sempre funcional. Os commits e pushes desse fluxo estão autorizados.
- **Estado externo:** o usuário concluiu o Google Cloud (projeto, consentimento, cliente OAuth) e a pasta do Drive. As credenciais estão guardadas fora do repositório e serão inseridas no `.env.local` quando o assistente pedir (B-1 resolvido do lado do usuário).

## DEC-010 — Decisões técnicas da Fase 0
- **Data:** 2026-09-29 · **Status:** aceita
- **Decisões:**
  1. **Next.js 16.3.6** (estável atual) com React 19.2, Tailwind 4, Vitest 5 e zod 4. **Sem Cache Components**: todas as rotas são `force-dynamic` via layout raiz (confirmado na documentação empacotada em `node_modules/next/dist/docs/`).
  2. **`node:sqlite` confirmado (ADR-03)** em `next dev` e em `next build && next start`, carregado por `process.getBuiltinModule`. O fallback `better-sqlite3` não é necessário.
  3. **Migrações como módulos TypeScript** (`src/server/db/migrations/NNN-*.ts`), em vez de arquivos `.sql` lidos do disco, para não depender de rastreamento de arquivos do bundler. Aplicadas no primeiro `getDb()`, que o `instrumentation` chama no boot.
  4. **`server-only` fora dos módulos importados pelo `instrumentation`** (`db`, `logger`, `boot`), porque o `instrumentation` não roda na camada React Server.
  5. **Fontes do sistema** em vez de `next/font/google`, para o build funcionar sem internet.
  6. **npm 11 não executa scripts de instalação por padrão.** Só o `unrs-resolver` (opcional, do ESLint) fica pendente, e o lint funciona sem ele. Registrar no README.
  7. **Encerrar processos pelo PID da porta**, nunca por nome de imagem.
- **Consequências:** `DATABASE_PATH` é lido direto do `process.env` no `getDb()`, para um env inválido não derrubar o boot. As demais configurações passam por `getEnv()` (zod).

## DEC-011 — Leitor de `.xlsx` próprio (substitui exceljs, ADR/DEC-009 do rascunho)
- **Data:** 2026-09-29 · **Status:** aceita
- **Contexto:** o `Ata_registro.xlsx` da banca foi gerado pelo OpenXML SDK:
  - elementos com prefixo de namespace (`<x:workbook>`, `<x:sheetData>`);
  - `Target` absolutos nos `.rels` (`/xl/worksheets/sheet1.xml`);
  - BOM nos XML;
  - células `t="str"`.

  O exceljs falha ao abrir esse arquivo (`parseWorkbook` devolve `undefined`). Como a banca usará "arquivos da mesma natureza", o formato precisa ser lido com robustez.
- **Decisão:** leitor próprio em `src/server/extract/xlsx.ts`:
  - **JSZip** abre o pacote;
  - **fast-xml-parser** com `removeNSPrefix`;
  - lê shared strings, inline strings e `t="str"`;
  - detecta datas pelo `numFmt` (embutidos 14–17 e 22; formato personalizado com dia, mês ou ano — `m` de minuto e `AM/PM` não contam) e respeita `date1904`. **Emenda (DEC-013):** os embutidos 18–21 e 45–47 são só hora/duração e deixaram de virar data;
  - datas viram `AAAA-MM-DD` pelos componentes UTC.
- **Verificação:** testes com os dois arquivos da banca (prefixados) **e** com um `.xlsx` sintético no estilo do Excel (sem prefixo, shared strings, rich text, data nativa).
- **Alternativa descartada:** SheetJS. A versão do npm (0.18.5) tem vulnerabilidade conhecida, e a versão corrigida só é distribuída fora do npm.

## DEC-012 — Decisões técnicas da Fase 1
- **Data:** 2026-09-29 · **Status:** aceita
- **Decisões:**
  1. `@googleapis/drive` + `google-auth-library` 11.1.0 (a mesma versão usada internamente, deduplicada).
  2. OAuth: `state` e `code_verifier` num cookie httpOnly de 10 min com path `/api/auth/google`. Host canônico: `/start` redireciona para `APP_BASE_URL`. O callback exige que o escopo concedido seja só leitura e que o ID configurado seja uma pasta acessível. A carga inicial é disparada com `after()` do Next.
  3. O `runSync` lista a árvore inteira **antes** de gravar qualquer coisa: se o Drive falhar, nada muda (AR-16). O sumiço só é concluído sob pastas listadas por completo, confirmado por `files.get` (lixeira, sem acesso ou fora da árvore), com cascata para subpastas.
  4. Arquivo que volta da lixeira com o mesmo conteúdo tem o cache recuperado (bug achado pelo teste).
  5. "Sincronizar agora" é uma Server Action que espera o ciclo terminar (pasta pequena) e mostra o resultado. O polling de ciclos automáticos fica para a Fase 4.
  6. No boot, execuções que estavam `running` viram `failed(interrupted)` (um processo por instalação).

## DEC-013 — Endurecimento da Fase 1 após a auditoria (revisão, segurança e santa-loop)
- **Data:** 2026-09-29 · **Status:** aceita
- **Contexto:** a auditoria antes do merge da Fase 1 incluiu:
  - revisão de código (`.claude/reviews/fase-1-review.md`);
  - varredura de segredos, dependências e cabeçalhos;
  - dois revisores independentes em modo adversarial (santa-loop).

  Nenhum achado foi CRITICAL. Os mais graves:
  - um título de Markdown hostil travava o processo (ReDoS, backtracking cúbico: 4 mil espaços levavam 4,7 s);
  - o servidor escutava em `0.0.0.0` sem checar `Host`, então alguém da rede local podia revogar a conexão durante a demo;
  - fontes da pasta antiga continuavam "processadas" depois de trocar `DRIVE_TEST_FOLDER_ID`;
  - `.xlsx` malformado virava planilha vazia.
- **Decisões:**
  1. **Superfície de rede:**
     - os scripts `dev`, `start` e `app` escutam só em `127.0.0.1`;
     - o `src/proxy.ts` recusa (403) qualquer `Host` diferente do de `APP_BASE_URL`, o que cobre IP da rede e DNS rebinding;
     - as Server Actions repetem a checagem, como a documentação do Next recomenda.
  2. **Host canônico:** o Next normaliza `127.0.0.1`, `[::1]` e `localhost` para o mesmo host (`server/web/next-url.js`) e reescreve o `Location` como relativo (`adapter.js`). Por isso o redirecionamento 30x antigo não funcionava. Agora o app responde com uma página HTML mínima com `meta refresh` para o host canônico, com o endereço escapado.
  3. **Cabeçalhos:**
     - `X-Frame-Options: DENY` e `frame-ancestors 'none'`;
     - `nosniff`;
     - `Referrer-Policy: same-origin`;
     - `Permissions-Policy`;
     - `poweredByHeader: false`.
  4. **`import "server-only"`** em `env`, `auth/*`, `container` e `google-drive-gateway`. Os módulos do `instrumentation` ficam de fora (DEC-010.4).
  5. **Conteúdo hostil:**
     - o extrator de Markdown não usa regex com quantificadores sobrepostos;
     - linhas com mais de 4 KB não viram título nem metadado;
     - o espaço no fim da linha é removido por laço;
     - `.md` que não é UTF-8 válido é lido como Windows-1252, em vez de trocar bytes por U+FFFD;
     - **[rodada 2]** `.md` em UTF-16 com BOM é decodificado;
     - **[rodada 2]** títulos e metadados dentro de blocos de código (```` ``` ````/`~~~`) não contam.
  6. **`.xlsx` estrito:** lançam erro com motivo (nunca vira vazio):
     - parte ausente;
     - XML inválido (`XMLValidator`);
     - aba sem relacionamento;
     - shared string inexistente.

     Também:
     - `sharedStrings`/`styles` são resolvidos pelos `.rels`, sem diferenciar maiúsculas;
     - cabeçalho repetido vira "Nome (2)", sem nunca colidir com um cabeçalho existente;
     - formatos só de hora não viram data, nem os embutidos nem os personalizados (`hh:mm`, `mm:ss`, `h:mm AM/PM`);
     - `t="d"` é lido;
     - **[rodada 2]** pasta de trabalho sem abas lança erro;
     - **[rodada 2]** abas de gráfico/diálogo são ignoradas;
     - **[rodada 2]** datas impossíveis (mês 13, serial fora de 1–2.958.465) não viram data.
  7. **Escopo:**
     - fonte cujo pai não está na árvore atual nem entre as fontes conhecidas vem de outra pasta configurada, então vira `out_of_scope`;
     - se alguma subpasta falhou na listagem, "fora da árvore" é inconclusivo (AR-16);
     - a cascata herda o estado da pasta;
     - **[rodada 2]** com a árvore incompleta, a cascata espera o próximo ciclo completo, e o filho herda o estado do pai que já tinha saído;
     - **[rodada 2]** falha temporária ao confirmar um sumiço não conclui nada, mas conta como "a confirmar", vai para o log e deixa o ciclo "com avisos" (F3.6).
  8. **Drive:**
     - tamanho conferido pelo `size` antes de baixar;
     - timeout de 30 s por chamada;
     - motivo do erro lido também de corpo em texto ou bytes (export e download);
     - cotas em 403 (`dailyLimitExceeded`, `quotaExceeded`…) ganham nova tentativa;
     - **[rodada 2]** tempo esgotado (`AbortError`/`TimeoutError`) é falha temporária;
     - **[rodada 2]** `retry: false` no cliente, para as tentativas não se multiplicarem com o `withRetry` (máximo de 4, §6.9);
     - **[rodada 2]** `\` e `'` escapados na consulta `q`.
  9. **OAuth:**
     - o callback revoga o token quando recusa a autorização;
     - pasta na lixeira é recusada;
     - "Desconectar" informa quando a revogação no Google falhou;
     - renovação de token e falha de um ciclo antigo não reativam uma conexão encerrada;
     - a tag GCM precisa ter 16 bytes;
     - **[rodada 2]** desconectar apaga também o e-mail e o escopo guardados;
     - **[rodada 2]** falha passageira do Google no callback tem mensagem própria;
     - **[rodada 2]** a consulta da conta e a falha de decifragem vão para o log.
  10. **Testes:** `@vitest/coverage-v8` (dev) e `npm run test:coverage`. Cobertura de `src/server` + `src/lib`: 76,5% → 84% das linhas.
- **Adiado de propósito:**
  - política de novo download para arquivo com falha permanente (vem com o backoff do scheduler, Fase 4);
  - histórico A→B→A em `source_versions` (Fase 4.3);
  - limite de descompressão do `.xlsx` (só a pasta do operador é lida; limitação documentada);
  - `DRIVE_MODE=local` (ADR-15 opcional);
  - tabela a 375 px e confirmação em "Desconectar" (Fase 9);
  - aviso "carga inicial iniciada" aparece mesmo se já havia um ciclo em curso, e "nova tentativa em seguida" (cota) só vale quando o scheduler existir (Fase 4).

---

## Decisões técnicas pendentes

| Pendente | Decidir até | Origem |
|---|---|---|
| ~~Arquitetura, stack, banco, OAuth, sincronização, versão/hash~~ → **DEC-007** | — | — |
| Decisões em aberto da arquitetura (OD-04…OD-11) | Ver `ARCHITECTURE.md` §16 | — |
| ~~Provedor e modelo de IA~~ → DEC-006. Falta: prompt, schema e `effort`, e o custo medido | M6 | D-10 |
| Política de cache e limpeza | Plano do M4 | D-14 |
