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
     - **[rodada 2]** datas impossíveis (mês 13, serial fora de 1–2.958.465) não viram data;
     - **[rodada 3]** referência de célula validada (até `XFD1048576`): antes, uma coluna com centenas de letras virava `Infinity` e o processo morria por falta de memória;
     - **[rodada 3]** código de formato lido em uma passada, sem regex, com limite de 255 caracteres e uma decisão por formato (não por estilo): um `.xlsx` de 1,5 KB travava o processo por 93 s;
     - **[rodada 3]** desambiguação de cabeçalhos linear;
     - **[rodada 3]** durações (`[h]:mm`, `[mm]:ss`) não viram data;
     - **[rodada 3]** fórmula sem valor calculado lança erro com orientação, em vez de célula vazia;
     - **[rodada 3]** coluna sem cabeçalho usa a chave `#E`;
     - **[rodada 3]** entidades numéricas (`&#10;`) e escapes `_xHHHH_` são decodificados;
     - **[rodada 3]** parte de estilos citada e ausente lança erro.
  7. **Escopo:**
     - fonte cujo pai não está na árvore atual nem entre as fontes conhecidas vem de outra pasta configurada, então vira `out_of_scope`;
     - se alguma subpasta falhou na listagem, "fora da árvore" é inconclusivo (AR-16);
     - a cascata herda o estado da pasta;
     - **[rodada 2]** com a árvore incompleta, a cascata espera o próximo ciclo completo, e o filho herda o estado do pai que já tinha saído;
     - **[rodada 2]** falha temporária ao confirmar um sumiço não conclui nada, mas conta como "a confirmar", vai para o log e deixa o ciclo "com avisos" (F3.6);
     - **[rodada 3]** subpasta que falhou na listagem é nomeada no aviso, fica "falhou" e vai para o log;
     - **[rodada 3]** item ausente de uma listagem completa que o Drive diz ainda estar na pasta conta como "a confirmar";
     - **[rodada 3]** a cascata nunca marca a própria pasta raiz.
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
     - **[rodada 2]** a consulta da conta e a falha de decifragem vão para o log;
     - **[rodada 3]** o escopo concedido só pode ter `drive.readonly` e escopos de identidade: Documentos e Planilhas, que permitem escrever, são recusados.
  10. **Testes:** `@vitest/coverage-v8` (dev) e `npm run test:coverage`. Cobertura de `src/server` + `src/lib`: 76,5% → 84% das linhas.
  11. **Rodada 4 (corrigida sem 5ª rodada, DEC-014):** fórmula com resultado de texto vazio (`t="str"`, `<v></v>`) é célula vazia, não erro (fórmula sem `<v>` continua recusada); título Markdown com U+2028/U+2029 (`[sS]` no lugar de `.`, antes não era nem reconhecido); `findEntry` com índice minúsculo por pacote e limite de 256 abas. Cobertura por 5 testes novos (170 no total).
- **Adiado de propósito:**
  - política de novo download para arquivo com falha permanente (vem com o backoff do scheduler, Fase 4);
  - histórico A→B→A em `source_versions` (Fase 4.3);
  - limite de descompressão do `.xlsx` (só a pasta do operador é lida; limitação documentada);
  - `DRIVE_MODE=local` (ADR-15 opcional);
  - tabela a 375 px e confirmação em "Desconectar" (Fase 9);
  - aviso "carga inicial iniciada" aparece mesmo se já havia um ciclo em curso, e "nova tentativa em seguida" (cota) só vale quando o scheduler existir (Fase 4);
  - **[rodada 3]** corrida de reconexão (um ciclo antigo pode marcar a conexão nova como "reautorizar") e renovação do lease em ciclos longos entram com o scheduler (Fase 4);
  - **[rodada 3]** também adiados: cancelar o ciclo em curso ao desconectar; o bug de ano bissexto de 1900 do Excel (só datas antes de 1900-03-01); registrar no log o fallback de codificação do `.md`;
  - **[rodada 3]** a metodologia do santa-loop limita a 3 rodadas. A 3ª também reprovou, e os achados dela foram corrigidos sem uma 4ª revisão. A decisão sobre fazer mais uma rodada ficou com o usuário.

## DEC-014 — Política permanente de execução de IA (modelos, effort, subagentes, revisão)
- **Data:** 2026-09-30 · **Status:** aceita (instrução do usuário)
- **Contexto:** as sessões de 29/09 esgotaram o limite de uso por causa de:
  - agente principal em Opus o tempo todo;
  - santa-loop com 4 rodadas de 2 revisores Opus, cada um com ~200–250 mil tokens;
  - contexto da sessão acima de 700 mil tokens.
- **Decisão:** vale `docs/AI_EXECUTION_POLICY.md`:
  - **Sonnet + Medium** como padrão;
  - MODEL ROUTING curto antes de tarefas relevantes;
  - subagentes só com ganho claro;
  - revisão proporcional ao risco;
  - santa-loop só em milestone crítico ou pré-entrega;
  - compactação nos limites entre fases.

  O `CLAUDE.md` aponta para esse documento.
- **Consequência imediata:** não haverá mais rodadas de santa-loop na Fase 1. Os achados verificados da 4ª rodada são corrigidos diretamente, com teste e `verification-loop`.

---

## Decisões técnicas pendentes

| Pendente | Decidir até | Origem |
|---|---|---|
| ~~Arquitetura, stack, banco, OAuth, sincronização, versão/hash~~ → **DEC-007** | — | — |
| Decisões em aberto da arquitetura (OD-04…OD-11) | Ver `ARCHITECTURE.md` §16 | — |
| ~~Provedor e modelo de IA~~ → DEC-006. Falta: prompt, schema e `effort`, e o custo medido | M6 | D-10 |
| Política de cache e limpeza | Plano do M4 | D-14 |

## DEC-015 — Revisão formal da Fase 2 (2026-09-30)

- **Contexto:** revisão de código e segurança pedida pelo usuário depois do merge da Fase 2. Um revisor independente (Sonnet, sem santa-loop, DEC-014), mais `npm audit` (0 vulnerabilidades), AgentShield e cobertura.
- **AgentShield:** 545 "críticos" são falsos positivos (hashes de integridade do `package-lock.json` lidos como chaves do Azure); os demais são "defesas de prompt" ausentes no `CLAUDE.md`, que é instrução de desenvolvimento e não prompt de aplicação. Aceitos.
- **Achados confirmados e corrigidos (com teste):**
  1. **HIGH:** o índice podia apontar um arquivo declarado superado como registro (a linha "X foi substituída por Y, a nova fonte das atividades" registrava X). Agora o superado nunca é registro e a linha de substituição aponta o substituto.
  2. Linhas puladas na importação (ID inválido, repetido, sem título, estado e prazo não reconhecidos) só ficavam no banco. Agora aparecem em "Fonte das atividades", em `/sincronizacao`.
  3. Importação sem nenhuma linha válida gravava a marca de "importação inicial" e travava para sempre. Agora não grava a marca, mostra a pendência e tenta de novo na próxima sincronização.
  4. Falha do hook de importação só ia para o log. Agora o resultado (importado, pendente, erro) fica em `app_settings.registry_import` e a tela mostra.
  5. Localizador da origem histórica usava o texto do cabeçalho (`Atividades!Origem5`); agora usa a letra da coluna (`Atividades!I5`).
  6. **LOW:** redirecionamento aberto teórico na troca de persona (`//evil.com` no `Referer`); extraído para `lib/return-path.ts`, com teste.
  7. Títulos `h3` sem `h2` nas listas (h2 só para leitores de tela) e `aria-live` inútil em texto de servidor removido.
  8. IDs que só diferem na caixa são a mesma atividade; linha sem título não consome o ID; sinônimos "nome" e "entrega" removidos (ambíguos); cabeçalhos toleram pontuação.
  9. Migração `003-owner-index`: o índice único de responsáveis misturava `member_id` e nome bruto na mesma expressão (colisão teórica).
- **Verificado sem problema (pelo revisor):** cookie e persona, host e CSRF das actions, `searchParams`, SQL parametrizado, XSS e URLs, regex do índice, transação e idempotência, append-only, logs, datas.
- **Não feito de propósito:** cobertura automática do cookie e das actions (só o E2E da Fase 9 cobre, pois dependem do runtime do Next).

## DEC-016 — Sincronização automática in-process (Fase 4, 2026-09-30)

- **Decisão:** o agendador (`sync/scheduler.ts`) é uma repetição de `setTimeout` sem sobreposição, ligada no `boot()` (via `instrumentation.ts`, só em `NEXT_RUNTIME=nodejs` e fora do build), com guarda em `globalThis` (ADR-05, RT-B). Primeiro ciclo ~5 s depois do boot; depois, a cada `SYNC_INTERVAL_SECONDS` (padrão 60 s, 30 a 600).
- **Falha:** o intervalo dobra a cada falha seguida, com teto de 5 min (ou o intervalo, se maior), o que preserva os 15 min da banca (F3.1). Sucesso ou parcial volta ao normal. Exceção no ciclo conta como falha e não derruba o agendador.
- **Sem conexão ou autorização perdida:** o ciclo devolve `not_connected` sem chamar o Google, e o estado aparece na tela.
- **"Sincronizar agora"** usa o mesmo `requestSync`: se um ciclo está em curso, devolve "já em execução" em vez de abrir outro (a trava única continua no banco, com lease).
- **Desatualização derivada** (`sync/freshness.ts`): último ciclo falhou, ou último sucesso há mais de 2× o intervalo. Aparece na faixa global e como "Potencialmente desatualizado" acima das listas de atividades. Fonte que sumiu aparece na referência da atividade como "Fonte indisponível desde …".
- **Detalhe da fonte** (`/fontes/[fileId]`): estado, motivo, autoridade, versões processadas e datas (primeira detecção, modificação no Drive, processamento), para cronometrar M-3.
- **Diagnóstico:** `/api/health` mostra banco, agendador (último ciclo e falhas seguidas) e estado da conexão, sem segredos.
- **Pendente (4.4):** validação com o Drive real que exige ações do usuário (subir, editar, renomear, apagar arquivos). Roteiro no `VALIDACAO.md`. Os cenários equivalentes já têm teste com o Drive falso (CA-F3.1–F3.6).

## DEC-017 — Auditoria das Fases 3 e 4 (2026-09-30)

- **Contexto:** revisão de código e segurança de `349243e..4433724` por um único revisor independente (Sonnet, DEC-014), mais `npm audit` (0 vulnerabilidades), varredura de segredos e cobertura (85%). Veredito do revisor: aprovado, sem CRITICAL nem HIGH.
- **MEDIUM corrigidos (com teste):**
  1. Editar uma atividade com estado "a confirmar" mudava o estado para "a fazer" em silêncio. Agora o formulário oferece "Estado a confirmar", o campo presente e vazio significa `null`, e só uma escolha da pessoa muda o estado.
  2. `boot()` podia derrubar o servidor com banco inválido e marcava "iniciado" antes de dar certo. Agora todo o `boot()` está protegido, a marca só vale no sucesso (a próxima chamada tenta de novo) e `/api/health` informa `start_failed`.
  3. Linha do registro com ID igual ao de uma atividade criada pela interface antes da importação já era listada em "linhas com problema"; a mensagem agora explica a causa. Mantive `LIA-` (DN-15) em vez de trocar o prefixo.
- **LOW corrigidos:** limite de tamanho não bloqueia mais a edição de campo importado que já vinha maior (só vale se o valor mudar); link do resumo de erros e `aria-describedby` do grupo de responsáveis; motivo do bloqueio avisa que vira as notas, e os campos de motivo têm `maxLength`; detalhe e edição consultam só a atividade pedida; `/api/health` registra falha no log e informa o motivo quando o agendador não subiu; contador de geração no agendador evita duas cadeias em `stop()` seguido de `start()`.
- **Não feito de propósito:** teste automatizado das Server Actions (dependem do runtime do Next; cobertas no navegador e pelo E2E da Fase 9); `raw_name` dos membros é regravado com o nome atual ao trocar responsáveis (o valor cru importado continua no histórico do evento de importação).

## DEC-018 — Classificação de autoridade e precedência visível (Fase 5, 2026-09-30)

- **Classificação calculada na leitura**, não gravada (`authority/classifier.ts`): sempre coerente com o que está no banco, sem segunda fonte de verdade. Só o registro vigente ainda grava `authority_class` (na importação).
- **Ordem das regras** (ajuste em relação à lista da ADR-11): 1) registro apontado pelo índice; 2) o próprio índice; 3) superado (status `deprecated`/`superado`, `substituido_por`, outro documento com `substitui:` que o nomeia, ou o índice o declara superado); 4) **ata** (tem `data_da_reuniao`); 5) citado no índice com `status` ativo ou parcial → direção; 6) o resto → sem autoridade. **Por que a ata vem antes da direção:** as atas também são citadas no índice e também declaram `status: ativo`; sem isso, seriam tomadas por documento de direção. `status: ativo` sozinho, sem citação no índice, não dá autoridade.
- **"Possível conflito"** só para planilhas sem autoridade que têm nome parecido (palavra em comum) ou cabeçalho parecido (colunas de ID e de atividade) com o registro, com os motivos calculados (não apontado pelo índice, aba diferente, 0 registros, nome e cabeçalho parecidos).
- **Precedência:** `PRECEDENCE_RULE_TEXT` (`lib/precedence-rule.ts`) é a fonte única da tela `/como-decidimos` e do README; `resolvePrecedence` é puro e deriva pendências e conflitos sem escrever (as propostas chegam na Fase 6). Link "Como o app decide" no rodapé, nas pendências de fonte e nos arquivos sem autoridade ou históricos.
- **Exibição:** coluna "Autoridade" na tabela de fontes e no detalhe da fonte, em texto, com os motivos.

## DEC-019 — IA: sugestões com evidência e revisão humana (Fase 6, 2026-09-30)

- **Modelo e custo (spike 6.0, medido):** `claude-sonnet-5-5`, `effort: medium`, pensamento adaptativo (padrão), Structured Outputs (`output_config.format` com o esquema do zod). **7 documentos reais gravados: US$ 0,0086 a 0,0134 por ata (média ≈ US$ 0,0115), 2.800 a 3.100 tokens de entrada, 290 a 770 de saída, 4 a 7 s.** Uma carga com as 3 atas do pacote custa cerca de US$ 0,035. O `effort: medium` já acertou os 7 cenários; não foi preciso subir.
- **A IA só propõe.** Nenhuma ferramenta e nenhum `tool_choice` (o modelo só devolve o objeto). Provedores isolados: `anthropic`, `recorded` (respostas gravadas, sem rede) e `disabled` (sem chave: a análise fica "desligada" e o app segue). `ai_calls` guarda só tokens, custo e status, nunca o conteúdo.
- **Validador determinístico (as regras do §6.5):** evidência literal (Markdown, aspas, espaços e caixa normalizados), alvo do update mencionado na evidência **ou no parágrafo dela**, datas só inequívocas (ISO, dd/mm/aaaa, "d de mês de aaaa"), responsáveis conhecidos e presentes no trecho (mudança de responsável sempre com aviso), frente conhecida (incerta se o texto não a afirma), hipótese sem dono rebaixada a "sem ação", "confirma o oficial" sem sugestão (a ata vira origem histórica), dedupe por chave, "possível relação" com atividade existente. **Achado do spike:** a evidência do modelo nem sempre repete o ID da atividade (o ID está na frase vizinha); por isso a menção vale no parágrafo. Como isso alarga a regra, acrescentei marcadores de instrução dirigida à IA (defesa em profundidade contra injeção, V-12).
- **Fila:** pós-sincronização, em segundo plano (o ciclo não espera a IA), uma análise por vez, chave arquivo + hash + versão do prompt (idempotente), `waiting_registry` até o registro ser importado, até 3 tentativas com espera crescente, "Tentar novamente", limite de entrada (`AI_MAX_INPUT_CHARS`, sem truncar). Fonte editada: sugestões pendentes da versão antiga ficam "fonte alterada" e são substituídas pela nova análise.
- **Revisão (`suggestion-service`):** aceitar, ajustar e aceitar, rejeitar com motivo obrigatório; papel de revisor checado no servidor; a sugestão é reivindicada por `UPDATE … WHERE pendente` (recarregar não repete); o valor oficial precisa ser o que a sugestão viu; o evento da atividade leva o vínculo à sugestão e à fonte; a atividade passa a apontar para a planilha e para a ata (`updated_by`/`created_by`); campos ajustados pelo revisor ficam registrados à parte. Sugestão aceita de criação gera o ID `LIA-nnnn`.
- **Diferença do registro (6.5):** nova versão da planilha vigente → sugestões `origin=registry_diff` (nunca escrita direta); linha ausente → aviso, nada é apagado; registro esvaziado → aviso.
- **Fixtures (6.6):** 7 respostas reais do modelo em `tests/fixtures/ai/` (ata 01, 03, 04 do pacote e 4 sintéticas: "até sexta", injeção, dono desconhecido, decisão e hipótese), passadas pelo validador nos testes sem rede. `npm run ai:record` regrava (gasta tokens, exige `ANTHROPIC_API_KEY`).

## DEC-020 — Auditoria das Fases 5 e 6 (2026-09-30)

- **Contexto:** revisão de código e segurança de `da0c827..3b3e615` por um único revisor independente (Sonnet), mais testes com o Drive real e o modelo real. Resultado do revisor: **nenhum CRÍTICO**; 4 HIGH, 6 MEDIUM e 7 LOW. Nenhum caminho altera atividade sem passar pelo `ActivityService`/`SuggestionService`, nem aplica uma sugestão duas vezes (verificado por ele e pelos testes).
- **HIGH corrigidos (com teste):**
  1. Update cujo único pedido foi descartado (prazo relativo, dono desconhecido) virava "confirma o registro oficial" e ligava a ata à atividade como origem histórica. Agora vira "requer atenção: <motivos>", visível em "Trechos sem ação", sem vínculo.
  2. Análise presa em `running` depois de queda do processo: agora `processQueue` devolve `running` à fila (há um único processo).
  3. **CA-F4.4 entregue:** a página da atividade mostra "Conflito — requer decisão", com os valores e as fontes, quando duas sugestões pendentes divergem no mesmo campo (`resolvePrecedence` ligado à tela); o valor oficial não muda. Conferido com o Drive e o modelo reais: prazo 07/10 (Ata_2026-10-03) × 09/10 (Ata_2026-10-06.md).
  4. Sugestão de versão antiga podia nascer aceitável quando a fonte mudava durante a chamada ao modelo: o commit confere o hash atual (senão marca a análise como obsoleta e não grava), e aceitar/ajustar recusa se a fonte não está mais na versão da sugestão.
- **MEDIUM corrigidos:** sugestões de ata que deixou de ser ata ficam desatualizadas; sugestão desatualizada pode ser rejeitada (descartar); evidência mínima de 25 caracteres e estado sem marcador no trecho vira "incerto"; ID do alvo casa como palavra inteira; classificador: `substitui:` por nome inteiro, índice em voz ativa ("X substitui Y" marca Y), tokens numéricos não geram "possível conflito"; custo: a análise espera a versão ficar estável por 2 min (`debounceMs`), teto de 100 chamadas em 24 h, e a chamada paga é registrada em `ai_calls` mesmo se a gravação falhar.
- **Defeito que achei nos testes com o Drive real:** a chave de dedupe (DN-12) usava título e próximo passo, que o modelo reescreve a cada chamada; uma cópia idêntica da ata gerou uma segunda sugestão. Agora a chave de criação é a evidência literal, e a de atualização usa o alvo e os campos estruturados (prazo, estado, frente, responsáveis). As sugestões criadas antes da correção (chave antiga) continuam como estão.
- **LOW corrigidos:** "Tentar novamente" só para revisores; nome do arquivo e títulos vão dentro do JSON de contexto do prompt; `?aviso=` com `Object.hasOwn`; rótulo de fixture validado; revisores citados na mensagem vêm da configuração, não fixos.
- **Não feito de propósito:** debounce/teto por edição contínua além do básico (custo já previsível: ≈ US$ 0,012 por chamada, máx. 100/dia); reclassificação com `JSON.parse` de todo o acervo a cada requisição (perf; volume local pequeno); casamento de nome de arquivo homônimo em subpasta no índice (o índice cita só o nome); marcadores de injeção continuam sendo só defesa em profundidade.
