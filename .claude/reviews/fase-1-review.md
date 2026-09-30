# Code review: Fase 1 (`main...fase-1-drive`)

**Revisado em:** 2026-09-29 · **Branch:** `fase-1-drive` → `main` · **Commits:** b01290d, abe367a, 514db04, aed0265, d2d1c10
**Decisão:** REQUEST CHANGES. Não há CRITICAL. Há 1 HIGH e 5 MEDIUM a corrigir antes do merge. Validação verde.

## Resumo

O núcleo da Fase 1 está sólido:
- listagem completa antes de qualquer escrita;
- falha nunca vira ausência;
- tokens cifrados com AES-256-GCM;
- `state` + PKCE;
- erros tipados com mensagem segura;
- 100 testes cobrindo os cenários de sync.

Os problemas estão nas bordas: troca da pasta configurada, tamanho de download, revogação quando a autorização é recusada, `server-only` ausente, e o CA-F1.3 sem a data de "desatualizado desde".

## Achados

### CRITICAL
Nenhum.

### HIGH
- **H-1 · Fontes órfãs quando a pasta configurada muda** (`src/server/sync/sync-service.ts:197-248`)
  - **Problema:** o `reconcileMissing` só conclui algo sob pastas listadas neste ciclo. Se `DRIVE_TEST_FOLDER_ID` muda (erro de configuração corrigido, ou um terceiro seguindo o README), os itens da pasta antiga têm `parent_id` = raiz antiga, que nunca é listada. Eles ficam "processados" para sempre.
  - **Impacto:** viola F3.7 ("arquivos que saem da árvore deixam de ser considerados"). Na Fase 2, o importador que procura o `INDEX.md` entre as fontes rastreadas encontraria dois índices, e a fonte oficial ficaria ambígua.
  - **Correção:** fonte não vista cujo pai não está na árvore atual **nem** entre as fontes rastreadas vira `out_of_scope`. A cascata para os filhos de uma pasta que saiu propaga o mesmo estado.

### MEDIUM
- **M-1 · Limite de tamanho verificado só depois do download completo** (`google-drive-gateway.ts:40-47`, `sync-service.ts:110`)
  - **Problema:** um arquivo grande é baixado inteiro para a memória antes de ser recusado. A ARCHITECTURE §6.9 manda detectar pelo `size`.
  - **Correção:** conferir `item.size > maxBytes` antes de baixar.
- **M-2 · Autorização recusada não é revogada no Google** (`api/auth/google/callback/route.ts:46-79`)
  - **Problema:** com escopo errado, pasta inacessível ou ID que não é pasta, os tokens recebidos são descartados sem revogação, e a concessão fica ativa na Conta Google. A ARCHITECTURE §6.1 diz "senão recusa e revoga".
  - **Correção:** revogar o token recebido antes de redirecionar com o erro.
- **M-3 · `server-only` ausente nos módulos com segredos** (`config/env.ts`, `auth/*`, `container.ts`, `drive/google-drive-gateway.ts`)
  - **Problema:** a ARCHITECTURE §10.1 exige `import "server-only"` em todo módulo que lê o env. Hoje nenhum módulo tem.
  - **Impacto:** um import acidental num Client Component poderia empacotar código com segredos para o navegador. Nada disso acontece hoje, mas a proteção deveria existir.
  - **Correção:** adicionar o import. Os módulos do `instrumentation` (db, logger, boot) ficam de fora (DEC-010.4).
- **M-4 · CA-F1.3 incompleto: falta "desatualizado desde <data>"** (`components/sync-banner.tsx:36-42`)
  - **Problema:** a faixa de `reauth_required` não mostra desde quando os dados podem estar desatualizados. Com a conta `disconnected`, não aparece faixa nenhuma. A ARCHITECTURE §6.1 pede "desatualizado desde <data>" também depois de desconectar.
  - **Correção:** incluir o último sucesso na faixa e cobrir o estado `disconnected`.
- **M-5 · Renovação de token pode reativar uma conexão encerrada** (`auth/google-oauth.ts:73-79`, `token-store.ts:76-114`)
  - **Problema:** o listener `tokens` chama `saveTokens`, que força `status='connected'`. Se "Desconectar" (ou `reauth_required`) acontecer durante um ciclo em andamento e o cliente renovar o access token, a conexão volta a "conectada".
  - **Probabilidade:** baixa, porque a revogação precede a marcação.
  - **Correção:** a persistência de renovação só atualiza linha já `connected`.

### LOW
- **L-1 · Markdown não UTF-8 vira texto corrompido em silêncio** (`sync/extract-source.ts:17`)
  - **Problema:** o `TextDecoder` não fatal troca bytes inválidos por U+FFFD. Um `.md` em Windows-1252 é "processado" com acentos quebrados, e isso quebraria a conferência de evidência literal na Fase 6.
  - **Correção:** decodificar em UTF-8 estrito, com fallback para Windows-1252.
- **L-2 · Cabeçalho duplicado no `.xlsx` sobrescreve a coluna anterior** (`extract/xlsx.ts:136-143`)
  - **Problema:** duas colunas "Responsável" deixam só a segunda, com perda silenciosa de dado.
  - **Correção:** desambiguar com " (2)".
- **L-3 · Log de erro perde a causa** (`observability/redact.ts:49`)
  - **Problema:** `Error` vira só `{name, message}`, e o status e o motivo do Google (que estão no `cause`) somem. Isso atrapalha diagnosticar falhas reais na demo.
  - **Correção:** encadear `cause` com redação e limite de profundidade.
- **L-4 · Comentário incorreto em `requestSync`** (`container.ts:49`)
  - **Problema:** o comentário diz que "o gatilho manual se junta ao em curso", mas o código devolve `already_running` sem esperar.
  - **Correção:** ajustar o comentário. A agregação é item do scheduler (4.1).
- **L-5 · Rótulos tipados como `Record<string, …>`** (`lib/labels.ts`)
  - **Problema:** um estado novo sem rótulo quebraria em tempo de execução, não na compilação.
  - **Correção:** tipar pelos unions (`SyncStatus`, `RunStatus` e outros).
- **L-6 · Documentação diverge do código:**
  - "Desconectar" é Server Action (com checagem de Origin do Next), não `POST /api/auth/google/disconnect` (ARCH §6.1/§9.2);
  - o plano 1.3 ainda cita o exceljs (DEC-011);
  - o polling fica para a Fase 4 (DEC-012.5).
- **L-7 · Anotado, sem correção agora:**
  - `DRIVE_MODE=local` é aceito pelo env, mas não existe (ADR-15 opcional) e se comporta como `google`;
  - o fallback `text/plain` do export de Docs gera outro hash, o que daria uma "nova versão" espúria se o export em Markdown voltar a funcionar;
  - zip bomb num `.xlsx` (só a pasta própria é lida);
  - "Desconectar" sem confirmação (reversível);
  - tabela a 375 px esconde colunas (Fase 9);
  - reconexão aparece como "carga inicial".

## Validação

| Verificação | Resultado |
|---|---|
| Typecheck (`next typegen && tsc --noEmit`) | Pass |
| Lint (`eslint`) | Pass |
| Testes (`vitest`) | Pass: 100/100 |
| Build (`next build`) | Pass |
| Teste real com o Google (P-1) | Pass: CA-F1.1, F1.3, F1.4, F2.1, F13.2 (`docs/VALIDACAO.md`) |

## Arquivos revisados

Adicionados:
- `src/app/api/auth/google/{start,callback}/route.ts`, `src/app/not-found.tsx`, `src/app/sincronizacao/actions.ts`;
- `src/components/{notice,status-badge,submit-button,sync-banner}.tsx`, `src/lib/labels.ts`;
- `src/server/auth/*`, `src/server/container.ts`, `src/server/db/repos/*`, `src/server/drive/*`, `src/server/extract/*`, `src/server/sync/*`;
- `tests/helpers/*`.

Modificados: `src/app/layout.tsx`, `src/app/sincronizacao/page.tsx`, `src/server/boot.ts`, `package.json` e documentação.
