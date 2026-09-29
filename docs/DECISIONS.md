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

---

## Decisões técnicas pendentes

| Pendente | Decidir até | Origem |
|---|---|---|
| ~~Arquitetura, stack, banco, OAuth, sincronização, versão/hash~~ → **DEC-007** | — | — |
| Decisões em aberto da arquitetura (OD-04…OD-11) | Ver `ARCHITECTURE.md` §16 | — |
| ~~Provedor e modelo de IA~~ → DEC-006. Falta: prompt, schema e `effort`, e o custo medido | M6 | D-10 |
| Política de cache e limpeza | Plano do M4 | D-14 |
