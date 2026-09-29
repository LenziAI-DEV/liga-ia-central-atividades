# Plan: Marco 1 — Pasta conectada e fontes visíveis

**Source PRD**: `docs/PRD.md` (v0.2)
**Selected Milestone**: #1 "Pasta conectada e fontes visíveis" (F1, F2, F13)
**Complexity**: Large (inclui setup do projeto, OAuth e o pipeline de ingestão, que serão base de todos os marcos)
**Meta de data**: terça-feira 2026-09-29 (junto com o M2 — ver `docs/PROGRESS.md`)
**Status**: ❌ **SUBSTITUÍDO** por `docs/plans/IMPLEMENTATION_PLAN.md` (2026-09-28). Mantido só como histórico. ⚠️ **Rascunho anterior à arquitetura.** Depois que o `docs/ARCHITECTURE.md` for aprovado, este plano será realinhado a ele: `@googleapis/drive` + `google-auth-library` em vez de `googleapis`; `version` só como gatilho, com o hash do conteúdo como chave (ADR-06); PKCE; lease em `sync_runs`; atalhos não seguidos; IDs de decisão renumerados.

## Summary

Criar o esqueleto da aplicação e resolver quatro coisas neste marco:
- conectar a conta Google do operador por OAuth (somente leitura, feito no servidor);
- percorrer recursivamente a pasta configurada;
- extrair conteúdo de `.md`, `.xlsx` e Google Docs;
- mostrar na área **"Estado da sincronização"** o inventário de fontes, com estado em texto, motivo, link ao Drive e contagens, mais o botão "Sincronizar agora".

A sincronização automática fica para o M4. O pipeline de ingestão do M1 é o mesmo que ela vai reutilizar.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | — | **Não existe código ainda (projeto greenfield).** Este marco estabelece as convenções (abaixo) |
| Errors | — | Idem |
| Tests | — | Idem |

Convenções que este marco estabelece e os próximos devem seguir:
- **Pastas**:
  - `src/app/` guarda as rotas e a UI;
  - `src/server/<domínio>/` guarda a lógica do servidor (`config`, `db`, `auth`, `drive`, `extract`, `sync`);
  - `src/lib/` guarda utilitários puros;
  - testes ficam ao lado do código (`*.test.ts`).
- **Nomes**: arquivos em `kebab-case.ts`, tipos em `PascalCase`, funções em `camelCase`. Identificadores de código em inglês; textos da UI em português.
- **Erros**:
  - funções do servidor lançam erros tipados (`AppError` com `code`);
  - a borda (route handler ou server action) converte o erro em mensagem em texto para a UI;
  - **nunca** logar tokens, códigos OAuth, segredos nem conteúdo de documentos.
- **Acesso a dados**: um módulo de repositório por entidade, com SQL parametrizado; nada de SQL solto nos componentes.
- **Drive**: todo acesso passa pela interface `DriveGateway`, com uma implementação real e uma falsa para testes.

## Decisões técnicas propostas (entram em `DECISIONS.md` após a aprovação)

| ID | Decisão | Alternativas consideradas | Motivo |
|---|---|---|---|
| DEC-004 | **TypeScript + Next.js (App Router)**, um único app com UI e servidor. Node ≥ 22.13 (máquina atual: Node 24) | Python/FastAPI + HTMX; Node + SPA separada | Uma linguagem e um processo para instalar e rodar (`npm install` e `npm run dev`). SDKs oficiais do Google (`googleapis`) e da Anthropic em TS. Server Components e Server Actions mantêm segredos no servidor (AR-2). React ajuda nas telas interativas de revisão e filtros |
| DEC-005 | **SQLite local via `node:sqlite` (embutido no Node)**, arquivo em `data/app.db` (fora do Git), com migrações SQL versionadas | better-sqlite3; Postgres/Supabase | Não depende de compilação nativa (importa para rodar na máquina da banca, em Windows). Não exige serviço externo. Atende persistência após reinício (AR-5). Fallback: better-sqlite3, se o empacotamento do Next falhar (spike na Tarefa 2) |
| DEC-006 | **OAuth web server flow no servidor**, escopo `drive.readonly`, `access_type=offline`. Tokens guardados no SQLite **cifrados (AES-256-GCM)** com uma chave de `.env.local` | Guardar tokens em arquivo JSON | Segue [GUIA §3, §5, §10]. A cifra protege o arquivo do banco se ele for copiado |
| DEC-007 | Pasta raiz configurada por **`DRIVE_TEST_FOLDER_ID`** (env) e mostrada na UI (nome e link) | Escolher pasta pela UI | Recomendação de [GUIA §6.4]. Menos código |
| DEC-008 | **Versão da fonte** = campo `version` do Drive, mais hash SHA-256 do conteúdo extraído. Reprocessa só quando `version` muda | Só `md5Checksum` (não existe em Google Docs); só `modifiedTime` | Funciona para arquivos binários e nativos (RT-13) e dá idempotência (RN-10) |
| DEC-009 | Google Docs lidos com `files.export` em `text/markdown`, com fallback para `text/plain`. `.xlsx` lido com **exceljs** | Docs API `documents.get`; SheetJS | Markdown preserva os títulos. exceljs está no npm com licença MIT |
| DEC-010 | UI com **Tailwind CSS** e tokens da marca (`#1433BD`, `#19DCE3`) como variáveis CSS; testes unitários com **Vitest** | CSS Modules; Jest | É o padrão do create-next-app e dá velocidade. Vitest é rápido e nativo em TS |
| DEC-011 | **Anthropic** como provedor de IA (o usuário tem créditos). O modelo e o formato de saída serão escolhidos antes do M6, consultando a documentação atual | OpenAI; modelo local | Resolve parcialmente a Q-6 |

## Parte A — Setup guiado (ações do usuário, comigo orientando passo a passo)

> ⚠️ **Nunca cole Client Secret, tokens ou chaves de API no chat.** Eles vão direto para o arquivo `.env.local`, que não entra no Git.

### A1. GitHub
Eu executo depois da sua confirmação:
1. `git init`.
2. `.gitignore` criado **antes** de qualquer segredo existir.
3. Criação do repositório com `gh repo create`, na conta **LenziAI-DEV** e com a visibilidade combinada (Q-A).
4. Primeiro commit só com a documentação.

### A2. Google Cloud: projeto e API [GUIA §1]
1. Abrir https://console.cloud.google.com e criar o projeto **"LIA Case Central"**.
2. **APIs e serviços > Biblioteca**, procurar **Google Drive API** e clicar em **Ativar**.

### A3. Tela de consentimento [GUIA §2]
1. **Google Auth Platform > Branding**: nome do app "LIA Central (dev)" e e-mail de suporte (o seu).
2. **Audience**: **External**, status **Testing**, e **Test users** com o e-mail da conta Google que tem a pasta.
3. **Data Access**: adicionar só `https://www.googleapis.com/auth/drive.readonly`.

### A4. Cliente OAuth [GUIA §3–§4]
1. **Clients > Create client > Web application**, com o nome "LIA Central – local".
2. **Authorized JavaScript origins**: `http://localhost:3000`.
3. **Authorized redirect URIs**: `http://localhost:3000/api/auth/google/callback` (exatamente assim, sem barra no final).
4. Copiar o Client ID e o Client Secret **direto para o `.env.local`** (eu crio o modelo `.env.example`).

### A5. Pasta de teste no Drive [LEIA]
1. **Antes de enviar os arquivos:** em Drive > Configurações, **desmarcar "Converter uploads"**. Se ficar marcado, o `.xlsx` vira Planilha Google e deixa de ser `.xlsx`.
2. Criar a pasta **`LIA case teste`**.
3. Enviar `INDEX.md`, `ESTADO-ATUAL.md`, `GUIA_INICIAL.md`, `PLANO_EDITORIAL_ANTIGO.md` e `Ata_registro.xlsx` para a raiz dela.
4. Criar a subpasta **`Atas`** e enviar `Ata_2026-10-01.md` para dentro dela. Isso testa a leitura recursiva (CA-F2.1).
5. **Não** enviar ainda `02_…` e `03_…`: eles são os cenários do M4 e do M5.
6. Copiar o ID da pasta (o trecho depois de `/folders/` na URL) para `DRIVE_TEST_FOLDER_ID` no `.env.local`.

### A6. Anthropic (só no M6)
- Criar uma chave em console.anthropic.com e colocar em `ANTHROPIC_API_KEY` no `.env.local`. Não é necessária no M1.

## Parte B — Files to Change

| File | Action | Why |
|---|---|---|
| `.gitignore` | CREATE | Excluir `node_modules`, `.next`, `.env*` (exceto `.env.example`), `data/`, `*.db`, `client_secret*.json`, `*token*.json` [GUIA §10] |
| `.env.example` | CREATE | Variáveis só com marcadores |
| `package.json`, `tsconfig.json`, `next.config.ts`, `.nvmrc`, `vitest.config.ts`, `eslint.config.mjs` | CREATE | Scaffold e scripts `dev`, `build`, `start`, `test`, `typecheck`, `lint` |
| `src/server/config/env.ts` | CREATE | Leitura e validação das variáveis (zod). Mensagem clara listando só os **nomes** das variáveis ausentes |
| `src/server/db/index.ts`, `src/server/db/migrate.ts`, `src/server/db/migrations/001_init.sql` | CREATE | Conexão SQLite (WAL) e migrações |
| `src/server/db/repos/{sources,sync-runs,oauth}.ts` | CREATE | Repositórios |
| `src/server/auth/token-crypto.ts` | CREATE | Cifra AES-256-GCM dos tokens |
| `src/server/auth/google-oauth.ts` | CREATE | Montar a URL de autorização, trocar o código, obter o cliente autenticado, revogar |
| `src/app/api/auth/google/{start,callback,disconnect}/route.ts` | CREATE | Rotas OAuth, com `state` anti-CSRF em cookie httpOnly |
| `src/server/drive/gateway.ts`, `google-drive-gateway.ts`, `fake-drive-gateway.ts` | CREATE | Interface do Drive, implementação real (com retry e backoff) e implementação falsa para testes |
| `src/server/drive/walk-tree.ts` | CREATE | Percurso recursivo com paginação, conjunto de pastas visitadas e caminho |
| `src/server/drive/classify.ts` | CREATE | Tipo suportado ou não suportado, com motivo (por MIME **e** extensão, já que `.md` pode chegar como `text/plain` ou `application/octet-stream`) |
| `src/server/extract/{markdown,xlsx,gdoc}.ts` | CREATE | Extratores. Markdown: texto, títulos e metadados `chave: valor`. XLSX: abas, cabeçalho, linhas e referência de célula, com datas seriais convertidas para data ISO (DN-13) |
| `src/server/sync/run-full-sync.ts` | CREATE | Carga completa: trava contra execução simultânea, upsert idempotente, falha isolada por arquivo, contagens, marca como "indisponível" o que sumiu da árvore |
| `src/app/layout.tsx`, `src/app/globals.css` | CREATE | Estrutura com navegação pelas 6 áreas [CASE p8], tokens de marca e foco visível |
| `src/app/sincronizacao/page.tsx` e componentes | CREATE | Tela "Estado da sincronização" (F1.2, F2.3–F2.6) |
| `src/app/sincronizacao/actions.ts` | CREATE | Server action "Sincronizar agora" |
| `src/lib/datetime.ts` | CREATE | Formatação em America/Sao_Paulo |
| `docs/DIARIO_DE_BORDO.md` | CREATE | Entregável E-3, iniciado já neste marco |
| `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` | UPDATE | Stack, componentes, DEC-004…011 e estado |

## Modelo de dados do M1

- `sources`:
  - `file_id` (PK), `name`, `mime_type`, `web_url`, `modified_time`, `drive_version`, `md5`, `content_hash`, `path`, `parent_id`;
  - `kind` (`markdown | xlsx | gdoc | unsupported | folder`);
  - `status` (`pending | processed | failed | unsupported | unavailable`), `status_reason`;
  - `first_seen_at`, `last_seen_at`, `last_processed_at`.
- `source_contents`:
  - `file_id`, `drive_version`, `content_hash`, `extracted_json`, `extracted_at`;
  - guarda só a versão vigente e o mínimo necessário (F13.4).
- `sync_runs`:
  - `id`, `trigger` (`manual | initial | scheduled`), `started_at`, `finished_at`;
  - `status` (`running | success | partial | failed`), `counts_json`, `error_summary`.
- `oauth_connection`:
  - uma linha, com `encrypted_tokens`, `scope`, `connected_at`, `status` (`connected | reauth_required`), `last_error`.
- `app_meta`:
  - versão das migrações.

(As entidades Atividade, Membro, Referência, Sugestão e Evento entram a partir do M2.)

## Tasks

### Task 1: Repositório, gitignore e GitHub (A1)
- **Action**:
  - `git init`;
  - `.gitignore` e `.env.example`;
  - `gh repo create` com a visibilidade escolhida;
  - commit inicial só com a documentação (e os dados, conforme Q-B).
- **Validate**: `git status` limpo; `git check-ignore .env.local data/app.db` confirma que os dois são ignorados.

### Task 2: Scaffold + spike do `node:sqlite` dentro do Next
- **Action**:
  - `create-next-app` (TS, App Router, Tailwind, ESLint, `src/`) na raiz;
  - Vitest;
  - `engines.node >= 22.13`;
  - uma rota de teste que abre `node:sqlite` em `next dev` **e** em `next build && next start`.
- **Validate**: `npm run build` passa; a rota de teste responde; `npm test` roda.
- **Decisão de saída**: se o bundler não resolver `node:sqlite`, trocar para better-sqlite3 e registrar em DEC-005.

### Task 3: Configuração e banco
- **Action**: `env.ts` (zod), conexão, migrações e repositórios.
- **Validate**: testes com banco em memória (a migração aplica duas vezes sem erro; os repositórios fazem upsert).

### Task 4: OAuth
- **Action**:
  - cifra de tokens;
  - rotas `start`, `callback` e `disconnect`, com `state` em cookie httpOnly, `access_type=offline` e `prompt=consent`;
  - erro `invalid_grant` passa o estado para `reauth_required`;
  - `disconnect` revoga o acesso e apaga os tokens.
- **Validate**:
  - teste unitário de cifrar e decifrar (inclusive chave errada falhando);
  - teste manual: conectar, ver "Conectado", desconectar;
  - `grep` nos logs sem token.

### Task 5: Gateway do Drive, percurso e classificação
- **Action**:
  - `DriveGateway` (`getFolder`, `listChildren`, `downloadFile`, `exportDoc`);
  - implementação real com retry e backoff exponencial para 429, 5xx e rateLimit;
  - `walkTree` em largura (BFS), com `trashed=false`, `pageSize` 1000, `nextPageToken` e `visited`;
  - classificação com motivo.
- **Validate** (testes com o gateway falso):
  - 3 páginas de resultados;
  - subpasta com 2 níveis;
  - pasta repetida (sem loop);
  - atalho;
  - `.png` e `.docx` classificados como "formato ainda não processado".

### Task 6: Extratores
- **Action**:
  - Markdown: texto, títulos e metadados.
  - XLSX: abas, cabeçalhos, linhas com referência de célula, e datas convertidas para `AAAA-MM-DD`.
  - Google Docs: export em markdown com fallback; o erro de limite de 10 MB vira `failed` com motivo.
- **Validate** (testes com os arquivos de `dados_ficticios/` como fixtures):
  - o `.xlsx` de exemplo gera a aba "Atividades" com 4 linhas e prazos `2026-10-05`, `10-06`, `10-09` e `10-11`;
  - a planilha vazia gera a aba "Ata" com 0 linhas de dados;
  - o `.md` expõe `status: ativo` e `status: deprecated`.

### Task 7: Sincronização completa (manual e inicial)
- **Action**: `runFullSync(trigger)`:
  - trava (uma execução por vez);
  - percorre a árvore;
  - upsert por `file_id`;
  - pula a extração se `drive_version` não mudou;
  - falha isolada: `status=failed` com motivo, sem apagar o conteúdo anterior e **sem marcar como vazio**;
  - arquivos que estavam na árvore e sumiram viram `unavailable`;
  - grava as contagens.
- **Validate** (testes com o gateway falso):
  - a segunda execução não muda as contagens (idempotência, CA-F3.5 antecipado);
  - erro num arquivo não impede os outros (CA-F2.3);
  - arquivo renomeado mantém o `file_id`.

### Task 8: UI "Estado da sincronização" e estrutura de navegação
- **Action**:
  - layout com as 6 áreas (as que ainda não existem mostram "disponível em breve");
  - página com: estado da conexão, pasta (nome e link), texto do escopo ("esta pasta e subpastas; nada fora dela é lido"), última sincronização bem-sucedida e última tentativa (America/Sao_Paulo), contagens, botão "Sincronizar agora" com andamento visível;
  - tabela acessível de fontes: nome com link ao Drive, caminho, tipo, estado **em texto**, motivo, modificado em;
  - estados vazio, carregando, erro e "reautorização necessária".
- **Validate**:
  - navegação só pelo teclado com foco visível;
  - contraste dos pares usados ≥ 4,5:1 (registrado);
  - largura de celular sem rolagem horizontal da página.

### Task 9: Validação manual com o Drive real + documentação
- **Action**:
  - roteiro manual de CA-F1.1, F1.3 (revogar acesso), F1.4, F2.1 a F2.3 e F13.2;
  - iniciar `docs/DIARIO_DE_BORDO.md`;
  - atualizar `ARCHITECTURE.md` (componentes), `DECISIONS.md` (DEC-004…011) e `PROGRESS.md`;
  - marcar o M1 como `complete` no PRD.
- **Validate**: checklist abaixo preenchido com o resultado observado.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
git check-ignore .env.local data/app.db     # ambos devem ser ignorados
git grep -nE "GOCSPX|ya29\.|1//0|sk-ant" -- . ':!docs'   # nenhum segredo versionado
```

Manual (Drive real):
- [ ] CA-F1.1: pasta, escopo e última sincronização visíveis (horário de Brasília)
- [ ] CA-F1.3: acesso revogado → "reautorização necessária", sem perder o inventário
- [ ] CA-F1.4: "Sincronizar agora" atualiza o horário
- [ ] CA-F2.1: 6 arquivos, inclusive o da subpasta `Atas`, com links que abrem no Drive
- [ ] CA-F2.2: `.png` e `.docx` como "formato ainda não processado"
- [ ] CA-F2.3: falha simulada isolada
- [ ] CA-F13.2: a tela de consentimento pede só leitura

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| O bundler do Next não resolve `node:sqlite` | Média | Spike na Tarefa 2; fallback better-sqlite3 |
| "Converter uploads" ligado transforma o `.xlsx` em Planilha Google | Média | Passo A5.1; a classificação mostra o motivo se acontecer |
| `redirect_uri_mismatch` | Média | URI exata no A4; mensagem de erro orientando |
| O Google não devolve refresh token (consentimento já dado antes) | Média | `prompt=consent`; botão desconectar e reconectar |
| O `.md` chega com MIME genérico | Alta | Classificar também pela extensão |
| O export `text/markdown` indisponível para algum Doc | Baixa | Fallback `text/plain` |
| O M1 e o M2 no mesmo dia estouram o prazo | Média | Tarefas 5 a 7 guiadas por testes; UI mínima e funcional; polimento só no M9 |

## Acceptance
- [ ] Tarefas 1 a 9 concluídas
- [ ] Validação automática passa
- [ ] Checklist manual preenchido com o resultado observado
- [ ] Documentos canônicos atualizados
