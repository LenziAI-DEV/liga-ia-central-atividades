# Diário de bordo

> Registro informal de como o trabalho aconteceu: tentativas, decisões, mudanças de direção, ferramentas de IA usadas, verificações e aprendizados ([CASE p3]). Sem conversas completas e sem credenciais.

**Ferramentas de IA usadas para construir:** Claude Code (modelo Claude Opus 5.5) com o plugin ECC — agente `ecc:architect` para a arquitetura, skills `plan-prd`, `plan` e `claude-api` (documentação atual da API da Anthropic). **Dentro do produto:** Claude Sonnet 5.5 (`claude-sonnet-5-5`), só para propor sugestões a partir de atas (DEC-006).

---

## 2026-09-28 (seg) — Entender antes de construir

- **O que fiz:** li os 4 PDFs da banca e todo o pacote `dados_ficticios/` antes de escrever qualquer código. O `.xlsx` foi lido pelo XML interno, porque o Python da máquina não tinha `openpyxl`. As datas vieram como números seriais do Excel (46300.5), e conferi a conversão (2026-10-05 ao meio-dia).
- **Resultado:** `docs/CASE_ANALYSIS.md`, com requisitos rastreados até a página de origem, 24 ambiguidades e riscos.
- **Descoberta importante:** os dados têm "armadilhas" de propósito:
  - planilha vazia com nome parecido;
  - plano editorial antigo marcado `deprecated`;
  - "Bruno aprovará", que não faz de Bruno o responsável;
  - "Talvez possamos…", uma ideia sem dono.

  O centro do case é **autoridade das fontes**, não só leitura de arquivos.
- **Decisões:** PRD com 17 decisões nossas (DN-01…17), todas aprovadas. Perguntas enviadas à banca, que respondeu confirmando: proposta pendente não altera o oficial; edição da planilha vira diferença para revisão; revisor não precisa ser restrito por frente; a demo é ao vivo na máquina do candidato.
- **Arquitetura:** pedi ao agente `ecc:architect` uma arquitetura com alternativas avaliadas.
- **Correção de uma saída de IA (candidata ao E-7):** revisei o documento do agente antes de gravar e encontrei três problemas.
  1. Ele não incorporou as respostas da banca nem a escolha do modelo, enviadas enquanto rodava.
  2. Propôs "tool use com `tool_choice` forçado" e "temperatura 0" para a extração. Conferindo a documentação atual da API, os dois **retornam erro 400 no Claude Sonnet 5.5**. Troquei por Structured Outputs, thinking adaptativo com `effort` baixo e checagem de `stop_reason`.
  3. O intervalo de 120 s era longo demais para uma demo ao vivo. Baixei para 60 s.

  As correções estão marcadas com **[rev]** no `ARCHITECTURE.md`.
- **Outra melhoria vinda da revisão do agente:** o meu plano inicial usava o campo `version` do Drive como chave de reprocessamento. O agente apontou que `version` também muda quando o arquivo é **renomeado**, o que faria a IA reanalisar sem necessidade. A decisão final: `version` é só o gatilho, e o hash do conteúdo extraído é a chave (ADR-06).

## 2026-09-29 (ter) — Fase 0: fundação

- **Scaffold:** o `create-next-app` não aceita pasta com `docs/` e `dados_ficticios/`. Gerei numa pasta temporária e movi os arquivos. O Next 16 traz um `AGENTS.md` avisando que as APIs mudaram, com a documentação dentro de `node_modules/next/dist/docs/`. Passei a consultá-la antes de usar instrumentation e cache: o `force-dynamic` continua valendo sem Cache Components.
- **Spike do maior risco técnico (RT-A):** o SQLite embutido do Node (`node:sqlite`), carregado por `process.getBuiltinModule` para não passar pelo bundler. **Funcionou em `next dev` e em `next build && next start`**, então não precisei do plano B (`better-sqlite3`, que exige compilação nativa).
- **Surpresas:**
  - O npm 11 não roda mais scripts de instalação por padrão. Só o `unrs-resolver` (opcional, do ESLint) ficou pendente, e o lint funciona sem ele. Isso vai para o README.
  - O `db.isOpen` do `node:sqlite` só existe a partir do Node 22.15, e o projeto promete Node ≥ 22.13. Troquei por uma flag local.
  - Tirei as fontes do Google do layout (`next/font/google` baixa arquivos no build e quebraria sem internet) e usei fontes do sistema.
- **Erro meu:** para derrubar o servidor de teste usei `taskkill /IM node.exe`, que encerrou **todos** os processos Node da máquina, inclusive um servidor MCP de outra ferramenta. Passei a encerrar só o processo da porta usada (`netstat` + PID).
- **Verificado:**
  - 41 testes (banco, migrações, env, redação de logs, datas e fuso, contraste da paleta);
  - typecheck e lint limpos;
  - build com as 9 rotas dinâmicas;
  - `npm run setup` gera o `.env.local` com a chave de cifra, e ele fica fora do Git;
  - `/api/health` → `db: ok`, as 6 áreas respondem, o boot pelo `instrumentation` migra o banco e grava log JSON.
- **Contraste:** um teste automatizado prova que todos os pares de cor de texto usados têm ≥ 4,5:1, e que ciano com texto branco (1,7:1) é proibido.
