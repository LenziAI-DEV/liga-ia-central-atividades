# Registro de validação (entregável E-4)

> Casos testados com entrada, resultado esperado, resultado observado e correções importantes ([CASE p9]). Casos obrigatórios da banca: **conflito** (V-5), **dado ausente** (V-11) e **arquivo adicionado ao Drive** (V-2). A lista completa vem do PRD §12.1. Preenchido fase a fase.

| # | Cenário | Entrada | Esperado | Observado | Correções | Status |
|---|---|---|---|---|---|---|
| V-1 | Visão pessoal | Personas Ana e Davi | Ana: ACT-101, ACT-104; Davi: ACT-102, ACT-104; troca não altera dados | — | — | pendente (Fase 2) |
| V-2 | Upload novo | `Ata_2026-10-04.md` direto no Drive | Processada em ≤ 15 min sem UI (meta ≤ 1 min); sugestão pendente | — | — | pendente (Fases 4/6) |
| V-3 | Edição | Editar `Ata_2026-10-03` (Google Doc) | Nova versão, 1 só fonte, sugestões antigas "fonte alterada" | — | — | pendente (Fase 4) |
| V-4 | Atualização de prazo | `Ata_2026-10-03` → ACT-101 | 1 update com evidência; oficial inalterado até o aceite; aceite registra histórico | — | — | pendente (Fase 6) |
| V-5 | **Conflito** (homônimo vazio) | `Ata - copia vazia.xlsx` | Atividades intactas; "sem autoridade / possível conflito" com motivos | — | — | pendente (Fase 5) |
| V-6 | Atividade manual | Criar + reiniciar | Persiste com autor e histórico | — | — | pendente (Fase 3) |
| V-7 | Ideia vaga | "Talvez…" | Não vira atividade | — | — | pendente (Fase 6) |
| V-8 | Erro de fonte | Lixeira / acesso revogado / Drive fora | Aviso; estado confirmado marcado como potencialmente desatualizado | — | — | pendente (Fases 1/4) |
| V-9 | Resumo pessoal | Ana × Davi após V-4 | Resumos diferentes, com fontes e estado de aprovação | — | — | pendente (Fase 7) |
| V-10 | Primeiro acesso | Membro sem orientação | Acha propósito (provisório), frentes, fonte e primeira ação | — | — | pendente (Fase 8) |
| V-11 | **Dado ausente** | Ata com "até sexta" / sem dono | Prazo e dono vazios, incerteza visível, nada inventado | — | — | pendente (Fase 6) |
| V-12 | Injeção via documento | Ata com instruções à IA | Nenhuma mudança; saída inválida descartada | — | — | pendente (Fase 6) |
| V-13 | Documento superado | `PLANO_EDITORIAL_ANTIGO.md` | "Histórico — substituído por GUIA_INICIAL.md"; não vira regra vigente | — | — | pendente (Fase 5) |

## Verificações de fundação (Fase 0, 2026-09-29)

| Verificação | Resultado observado |
|---|---|
| SQLite (`node:sqlite`) em `next dev` e `next build && next start` | `/api/health` → `{"db":"ok"}` nos dois modos |
| Migrações idempotentes e transacionais | Testes: 2ª execução não aplica nada; migração com erro é desfeita sem registro |
| Contraste da paleta (CA-F12.2) | 12 pares de texto ≥ 4,5:1 (teste automatizado); ciano + branco = 1,7:1 → proibido |
| Segredos fora do Git | `.env.local` gerado pelo `npm run setup` e ignorado (`git check-ignore`) |
| Env inválido | A mensagem lista só os **nomes** das variáveis (teste garante que o valor não aparece) |

## Fase 1 — Drive conectado (2026-09-29)

### Verificado automaticamente (Drive falso, 100 testes)

| Critério | Entrada | Esperado | Observado |
|---|---|---|---|
| CA-F2.1 | Carga do pacote inicial com `Atas/` como subpasta | 6 arquivos processados, com caminho e link | ✅ 6 processados, inclusive `Atas/Ata_2026-10-01.md` |
| CA-F2.2 | `.png` e `.docx` na pasta | "Formato ainda não processado" com motivo, sem conteúdo | ✅ motivo específico (imagem; .docx → converter para Documento Google) |
| CA-F2.3 | Falha simulada no download do `INDEX.md` | Só ele falha; os outros processam; ciclo "com avisos" | ✅ 5 processados + 1 falha; o próximo ciclo reprocessa |
| — | `.xlsx` corrompido | Falha com motivo, nunca "vazio" | ✅ "arquivo inválido ou corrompido" |
| CA-F3.5 | Segundo ciclo sem mudanças | Nenhum download, nada duplicado | ✅ 0 downloads, 6 "sem mudança" |
| CA-F3.1 | Ata nova adicionada | Detectada e processada, com data da reunião | ✅ `doc_date` 2026-10-04 |
| CA-F3.2 | Google Doc editado | 1 só fonte, hash novo, 2 versões | ✅ |
| CA-F3.3 | Arquivo renomeado | Mesma identidade, sem reprocessar | ✅ nome e caminho atualizados, 1 versão |
| CA-F3.4 | Lixeira / acesso revogado | Indisponível, cache apagado, motivo | ✅ ("na lixeira" / "removido ou sem acesso") |
| F3.7 | Movido para fora da pasta | "Fora da pasta" | ✅ |
| CA-F3.6 | Drive fora do ar | Ciclo falha; banco inalterado | ✅ banco byte a byte igual |
| CA-F1.3 | Token revogado | Pede reautorização; banco inalterado | ✅ |
| — | Subpasta com falha de listagem | Nada sob ela é removido | ✅ |
| — | `.xlsx` da banca (namespace `x:`) e `.xlsx` estilo Excel | Os dois lidos, datas puras | ✅ prazos 2026-10-05/06/09/11 (DEC-011) |

**Correções importantes:**
- troca do exceljs por um leitor próprio (DEC-011);
- recuperação do cache de conteúdo quando um arquivo volta da lixeira (bug achado pelo teste).

### Verificado manualmente (sem credenciais)

| Verificação | Observado |
|---|---|
| `/sincronizacao` sem `.env.local` preenchido | "Configuração pendente" com os nomes das variáveis; faixa global "Google Drive ainda não configurado" |
| "Conectar" sem credenciais | Redireciona para `?erro=config` (não quebra) |

### Pendente: teste com o Google real (P-1 em `PROGRESS.md`)

CA-F1.1, CA-F1.3 (revogar na Conta Google), CA-F1.4, CA-F2.1 com o Drive real, CA-F13.2 (consentimento só leitura).
