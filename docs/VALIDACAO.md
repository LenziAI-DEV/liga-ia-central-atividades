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

### Verificado com o Google real (2026-09-29, pasta `LIA case teste`)

Fonte: log `data/logs/app.jsonl`, tabelas `sync_runs`/`sources`/`oauth_connection` (consulta só de leitura) e navegador.

| Critério | Entrada | Esperado | Observado |
|---|---|---|---|
| CA-F13.2 | "Conectar conta Google" → tela de consentimento | Só leitura; tela "Google não verificou este app" em modo de teste | ✅ escopo gravado: só `drive.readonly`; tela esperada → Continuar |
| CA-F2.1 | Carga inicial (execução 1, 15:15) | 6 arquivos, inclusive `Atas/Ata_2026-10-01.md`, com links para o Drive | ✅ `seen 7` (6 arquivos + pasta `Atas`), `processed 6`, 0 falhas, em 6 s; os 7 links abrem no Drive |
| CA-F1.1 | Tela "Estado da sincronização" | Pasta (nome e link), escopo, último sucesso em America/Sao_Paulo | ✅ "LIA case teste", escopo em texto, "Último sucesso 29/09/2026 15:15" |
| CA-F1.4 | "Sincronizar agora" (execução 2, 15:40) | Andamento visível; horário atualizado; nada reprocessado | ✅ botão "Sincronizando…"; `processed 0`, `unchanged 6` em 1,1 s; "Último sucesso 15:40 (manual)" |
| CA-F1.3 | Acesso removido em Conta Google › Segurança; "Sincronizar agora" (execução 3, 15:50) | Reautorização necessária; inventário intacto | ✅ execução `failed(auth)`; faixa "reautorização necessária"; `sources` intacta (6 processados, 1 versão cada, mesmos horários de processamento) |
| — | Reconectar (execução 4, 15:51) | Volta a "conectado" sem reprocessar | ✅ `processed 0`, `unchanged 6` |
| CA-F2.2 | `.png` na pasta real | — | Não executado com o Drive real, por decisão do usuário: coberto pelos testes automáticos com o Drive falso |

**Qualidade da interface (QA de navegador, Lighthouse/axe):**
- acessibilidade 100 e boas práticas 100 em `/sincronizacao` (desktop e mobile), em `/` e na página 404;
- LCP 154 ms, CLS 0,00, INP 26 ms;
- teclado: o skip link é o 1º foco e o foco fica visível;
- 375, 768 e 1440 px sem rolagem horizontal da página;
- a tabela a 375 px esconde colunas: fica para a Fase 9.

### Auditoria antes do merge (2026-09-29): revisão, segurança e santa-loop

Achados e correções em DEC-013 e em `.claude/reviews/fase-1-review.md`. Cada correção tem teste automatizado. **Testes: 100 → 165. Cobertura de `src/server` + `src/lib`: 85% das linhas.** Depois das correções, sincronizações reais (execuções 5 e 6, 21:16 e 22:14) terminaram em `success`, com 6 sem mudança e 0 a confirmar.

| Caso | Entrada | Esperado | Observado depois da correção |
|---|---|---|---|
| ReDoS (conteúdo hostil) | Título com 50 mil espaços, linha de metadado e fim de linha gigantes | Extração em < 500 ms | ✅ (antes: 4 mil espaços levavam 4,7 s, e 50 mil travavam o processo) |
| Pasta configurada trocada | Sync com outra `DRIVE_TEST_FOLDER_ID` | O que era da pasta antiga fica "fora da pasta" e o cache é apagado | ✅ |
| Subpasta com falha de listagem | Arquivo movido para dentro dela no mesmo ciclo | Nada concluído ("fora da pasta" inconclusivo) | ✅ continua processado, com cache |
| Sumiço sem confirmação | Arquivo removido; `files.get` falha temporariamente | Nada concluído, mas registrado: ciclo "com avisos" e "a confirmar" | ✅ concluído como indisponível no ciclo seguinte |
| `.xlsx` com coluna de hora | Formatos `hh:mm`, `mm:ss`, `h:mm AM/PM`, `[h]:mm` | Hora/duração não vira data inventada (1899-12-30) | ✅ |
| `.xlsx` hostil: referência de célula | Coluna com 220 letras + célula sem referência | Falha com motivo | ✅ em < 1 s (antes: laço infinito, e o processo morria por falta de memória) |
| `.xlsx` hostil: formato e cabeçalhos | Código de formato com 30 mil `[` em 200 estilos; 10 mil cabeçalhos iguais | Leitura em < 1 s | ✅ (antes: 93 s e 33 s com o processo travado) |
| `.xlsx` com fórmula sem valor | `<f>` sem `<v>` | Falha com orientação; nunca "célula vazia" | ✅ |
| Subpasta que falhou na listagem | Falha temporária em `Atas` | Aviso cita a pasta, que fica "falhou"; registro no log | ✅ volta a "processado" no ciclo seguinte |
| `.xlsx` malformado com zip válido | Rels ausentes, aba ausente, XML truncado, shared string inexistente | Falha com motivo; nunca planilha vazia | ✅ |
| `.xlsx` com XML indentado | Shared/inline strings com indentação | Textos lidos | ✅ (antes: células sumiam em silêncio) |
| Arquivo > limite | `size` acima do limite | Falha com motivo, **sem baixar** | ✅ |
| Rede local / DNS rebinding | `Host: 192.168.x.x` ou `evil.example` | 403; o servidor nem escuta na rede | ✅ 403; conexão pelo IP da rede recusada |
| Abrir por `127.0.0.1` | `/api/auth/google/start` | Vai para `localhost` (cookie do OAuth) | ✅ (antes: `state_invalido`) |
| `?erro=__proto__` | Parâmetro forjado | Mensagem genérica, sem quebrar a página | ✅ |
| Revogação que falha ao desconectar | Google fora | Tela avisa e orienta a remoção manual | ✅ `?desconectado=local` |
| Cabeçalhos | Qualquer resposta | Anti-clickjacking, `nosniff`, `Referrer-Policy`; sem `X-Powered-By` | ✅ |
| Segredos | Bundle do navegador, logs, HTML, histórico do Git | Nenhum valor do `.env.local` | ✅ (só o ID da pasta aparece, no link da pasta, o que é esperado) |
| Dependências | `npm audit` | 0 vulnerabilidades | ✅ |
