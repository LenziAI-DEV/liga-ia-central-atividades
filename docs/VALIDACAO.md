# Registro de validação (entregável E-4)

> Casos testados com entrada, resultado esperado, resultado observado e correções importantes ([CASE p9]). Casos obrigatórios da banca: **conflito** (V-5), **dado ausente** (V-11) e **arquivo adicionado ao Drive** (V-2). A lista completa vem do PRD §12.1. Preenchido fase a fase.

| # | Cenário | Entrada | Esperado | Observado | Correções | Status |
|---|---|---|---|---|---|---|
| V-1 | Visão pessoal | Personas Ana e Davi | Ana: ACT-101, ACT-104; Davi: ACT-102, ACT-104; troca não altera dados | Ana: 101 e 104; Davi: 102 e 104; ACT-104 conta uma vez; 4 eventos antes e depois das trocas | Com o Drive real, 2026-09-30 | ✅ Fase 2 |
| V-2 | Upload novo | `Ata_2026-10-04.md` direto no Drive | Processada em ≤ 15 min sem UI (meta ≤ 1 min); sugestão pendente | — | — | ✅ Fase 4 (Drive real) |
| V-3 | Edição | Editar `Ata_2026-10-03` (Google Doc) | Nova versão, 1 só fonte, sugestões antigas "fonte alterada" | — | — | ✅ Fase 4 (Drive real) |
| V-4 | Atualização de prazo | `Ata_2026-10-03` → ACT-101 | 1 update com evidência; oficial inalterado até o aceite; aceite registra histórico | — | — | ✅ Fase 6 |
| V-5 | **Conflito** (homônimo vazio) | `Ata - copia vazia.xlsx` | Atividades intactas; "sem autoridade / possível conflito" com motivos | — | — | ✅ Fase 5 |
| V-6 | Atividade manual | Criar + reiniciar | Persiste com autor e histórico | LIA-0001 criada por Davi, editada (estado e próximo passo), app reiniciado: tudo e o histórico antes → depois continuaram | Navegador, banco de cópia, 2026-09-30 | ✅ Fase 3 |
| V-7 | Ideia vaga | "Talvez…" | Não vira atividade | — | — | ✅ Fase 6 |
| V-8 | Erro de fonte | Lixeira / acesso revogado / Drive fora | Aviso; estado confirmado marcado como potencialmente desatualizado | — | — | ✅ Fase 4 (Drive real) |
| V-9 | Resumo pessoal | Ana × Davi após V-4 | Resumos diferentes, com fontes e estado de aprovação | — | — | pendente (Fase 7) |
| V-10 | Primeiro acesso | Membro sem orientação | Acha propósito (provisório), frentes, fonte e primeira ação | — | — | pendente (Fase 8) |
| V-11 | **Dado ausente** | Ata com "até sexta" / sem dono | Prazo e dono vazios, incerteza visível, nada inventado | — | — | ✅ Fase 6 (respostas reais gravadas) |
| V-12 | Injeção via documento | Ata com instruções à IA | Nenhuma mudança; saída inválida descartada | — | — | ✅ Fase 6 (respostas reais gravadas) |
| V-13 | Documento superado | `PLANO_EDITORIAL_ANTIGO.md` | "Histórico — substituído por GUIA_INICIAL.md"; não vira regra vigente | — | — | ✅ Fase 5 |

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

## Fase 2 — Atividades e painel pessoal (2026-09-30)

- **Automático (203 testes):** importação do registro real (4 atividades, responsáveis, ACT-103 bloqueada, prazos como data pura), variante com IDs, cabeçalhos, aba e apelido diferentes (RNF-7), idempotência, cópia vazia homônima sem efeito (CA-F4.1), eventos append-only, filtros e ordenação, personas (parser e casamento de nomes).
- **Com o Google real:** "Sincronizar agora" importou ACT-101 a 104 e gravou 4 eventos `imported`, sem duplicar na segunda sincronização.
- **Navegador (CA-F5.1–F5.3):** Ana vê 101 e 104; Davi vê 102 e 104; filtro "Operações" mostra 2 de 4; "Todas" mostra 4; ACT-103 aparece "Bloqueada" em texto, com o motivo; parâmetros de URL inválidos são ignorados.
- **Pendente da fase:** CA-F5.5 (vencido com data de demonstração posterior) só tem teste do cálculo (`dueState`); CA-F5.6 conferido só como ausência de rolagem horizontal, não a 375 px reais (E2E na Fase 9).

## Fase 3 — Gestão de atividades com histórico (2026-09-30)

- **Automático (221 testes):** ID `LIA-000n` sem colidir com importados, evento por edição com antes → depois e motivo, sem mudança = sem evento, controle otimista (versão desatualizada recusada sem gravar), responsáveis "a confirmar" preservados, desfaz tudo se o evento falhar, persistência depois de fechar e reabrir o arquivo do banco (v06), validação com erro por campo.
- **Navegador (CA-F6.1–F6.3):** salvar sem título mostra "Erro: Informe o título da atividade." ligado ao campo e nada é gravado; "Testar persistência" criada como Davi (ID, autor, horário, "Criada manualmente", prazo "a definir"); estado editado; app reiniciado; dados e histórico intactos; "Bloquear" com motivo grava o estado e o motivo. Feito num banco de cópia (`DATABASE_PATH`), removido depois, para não sujar o dado de demonstração.
- **CA-F6.4:** o detalhe de ACT-101 mostra a planilha de origem com localizador e link e a ata histórica (conferido nos dados; a tela usa os mesmos dados de `/atividades`).
- **Não coberto:** as Server Actions e o formulário só são exercitados no navegador (sem teste automatizado até o E2E da Fase 9).

## Fase 4 — Sincronização automática (2026-09-30)

- **Automático (233 testes):** agendador (primeiro ciclo em 5 s, intervalo, sem sobreposição, backoff até o teto, exceção, parar, `register()` duas vezes = um só agendador) e desatualização derivada. Os cenários V-2, V-3, V-8 e as falhas de rede e de revogação (CA-F3.1–F3.6) têm testes com o Drive falso desde a Fase 1.
- **Com o Google real, sem clicar em nada:** o app iniciado sozinho rodou o 1º ciclo aos 5 s e o 2º aos 65 s, com "6 sem mudança" e `/api/health` mostrando o agendador ativo e a conexão. Feito num banco de cópia.
- **4.4 — a fazer pelo usuário, cronometrando (app aberto, sem clicar em "Sincronizar agora"):**
  1. Enviar `Ata_2026-10-04.md` à pasta → aparece como "Processado" em `/sincronizacao` (meta ≤ 5 min; esperado ~1 min). Anotar o horário do envio e o da primeira detecção em `/fontes/<id>`.
  2. Subir `Ata_2026-10-03.docx`, convertê-la em Google Docs e remover o `.docx` → uma fonte só, sem duplicar.
  3. Editar o texto do Doc → nova versão em "Versões processadas", mesma fonte.
  4. Renomear um arquivo → mesmo item, nome novo, versões preservadas.
  5. Mandar um arquivo para a lixeira → "Indisponível desde…", atividade continua com "Fonte indisponível".
  6. Cortar a rede por 2 ciclos → faixa "Falha na sincronização… dados potencialmente desatualizados"; reconectar → some sozinha.

### Resultado da validação 4.4 com o Drive real (2026-09-30)

Feita pelo usuário, com o app aberto e sem clicar em "Sincronizar agora". Todos passaram limpos, cada um em **menos de 1 minuto** (meta: até 5 min):
1. Arquivo novo (`Ata_2026-10-04.md`) apareceu como "Processado" sozinho.
2. `Ata_2026-10-03.docx` convertido em Google Doc e movido para `Atas`; depois de conferir o Doc no app, o `.docx` foi removido: uma fonte ativa só. (Dica para o README: o Doc convertido precisa estar dentro da pasta monitorada; atalhos são ignorados.)
3. Edição do Doc gerou nova versão na mesma fonte.
4. Renomear manteve o mesmo item com o nome novo.
5. Lixeira virou "Indisponível desde …".

**6. Rede cortada (feito pelo assistente, por simulação):** subi uma cópia do app com um proxy morto (`HTTPS_PROXY` inalcançável) e `SYNC_INTERVAL_SECONDS=30`, num banco de cópia.
- 1º ciclo: `failed` (`drive_unreachable`); intervalo dobrou para 60 s; 2º ciclo falhou; intervalo 120 s.
- Durante a falha: faixa "Falha na sincronização em 14:04. Os dados exibidos são de 14:03 e podem estar desatualizados desde então"; "Potencialmente desatualizado" nas listas; as 4 atividades e as 9 fontes intactas; `/api/health` com `lastStatus: failed`.
- Ao voltar a conexão: o ciclo seguinte teve sucesso (`8 sem mudança`), a faixa e o aviso sumiram sozinhos e as falhas seguidas voltaram a 0.
- Limite: simulei a queda com proxy, não cortando o Wi-Fi da máquina.

## Fase 5 — Autoridade e conflitos (2026-09-30)

- **Automático (251 testes):** classificação da carga inicial inteira (índice e guia "direção — ativo", estado atual "direção — parcial", registro vigente, ata, `PLANO_EDITORIAL_ANTIGO.md` "histórico — substituído por GUIA_INICIAL.md em 2026-10-01"); homônimo vazio "sem autoridade / possível conflito" com motivos (não apontado pelo índice, aba "Ata" ≠ "Atividades", 0 registros); variante com outro índice, outros nomes e `substitui:`; resolvedor de precedência (proposta pendente não muda o oficial, duas propostas diferentes = conflito, oficial intacto).
- **Integração V-5 (Drive falso):** a planilha homônima vazia chega depois da carga e o snapshot completo de atividades, responsáveis e eventos é **idêntico** ao anterior.
- **Dados reais (Drive do usuário):** `/sincronizacao` mostra o registro como "registro de atividades vigente", as atas como "ata", `ESTADO-ATUAL.md` como "direção — parcial" e `GUIA_INICIAL.md` como "direção — ativo"; `/como-decidimos` responde 200 e mostra a regra e as classes (CA-F4.3).
- **Ainda não exercitado com o Drive real:** o envio de `Ata - copia vazia.xlsx` (V-5) e a conferência de `PLANO_EDITORIAL_ANTIGO.md` como histórico na tela. Roteiro: subir o arquivo em `03_CONFLITO` e abrir `/sincronizacao` (aguardar ~1 min).
- **Pendente para a Fase 8:** CA-F4.2 na tela "Comece aqui" (a regra antiga não aparece como vigente), que ainda não existe.

## Fase 6 — IA: sugestões com evidência e revisão humana (2026-09-30)

- **Automático (296 testes):** 17 do validador (uma regra por teste, com saídas sintéticas ruins: data inventada, responsável desconhecido, evidência inexistente, injeção, mudança de responsável, hipótese, dedupe, possível relação), 7 passando as **respostas reais gravadas do modelo** pelo validador (CA-F7.1 a F7.5), 8 da fila (espera pelo registro, idempotência, fonte editada, IA fora do ar com tentativas, IA desligada, limite de tamanho, `ai_calls` sem conteúdo), 9 da revisão (CA-F8.1 a F8.5, valor que mudou, sugestão desatualizada, ajuste inválido) e 4 da diferença do registro.
- **Modelo real (spike 6.0):** 7 documentos, US$ 0,0086 a 0,0134 cada (média ≈ US$ 0,0115), ≤ 7 s. Resultados: ata 03 → 1 update de ACT-101 (prazo 2026-10-07, responsável mantido; Bruno só aprova); ata 04 → 1 criação para Carla (10/10, frente incerta, possível relação com ACT-103) e a ideia vaga em "sem ação"; ata 01 → nenhuma sugestão; "até sexta" → sem data, "prazo relativo — confirmar"; injeção → ignorada pelo modelo e bloqueada também pelo validador; Marina (desconhecida) → nome desconhecido, não vira membro.
- **Fim a fim com o Drive real e o modelo real (banco de cópia, removido depois):** as 3 atas foram analisadas sozinhas depois da sincronização (sem clicar em nada); `/sugestoes` listou a atualização de ACT-101 (05/10 → 07/10, com trecho e link) e a criação para Carla; como Davi os botões não aparecem e o motivo é dito em texto (CA-F8.4); rejeitar sem motivo pede o motivo (CA-F8.5); como Bruno, aceitar mudou ACT-101 para 07/10 e o histórico mostra "Sugestão aplicada por Bruno", prazo e próximo passo antes → depois, com as referências à planilha e à ata (CA-F8.1); como Carla, ajustar o próximo passo e aceitar criou LIA-0001, que aparece em "Minhas atividades" dela (CA-F8.3).
- **V-5 (planilha homônima vazia) com o Drive real:** conferido pelo usuário em 2026-09-30, passou.
- **Ainda a conferir:** V-2 e V-3 com IA no Drive real (enviar `Ata_2026-10-04.md` e editar a Ata_2026-10-03 pelo Drive e ver a sugestão e o "fonte alterada"); a diferença do registro com uma edição real do `.xlsx` (hoje só testada com conteúdo simulado).

### Testes com o Drive real depois da Fase 6 (2026-09-30, conector do Drive + app real + modelo real)

- **V-2 com IA (arquivo novo, cenário inédito):** `Ata_2026-10-05.md` (decisão que não estava nos dados do pacote) enviada ao Drive; **detectada em 28 s**, analisada sozinha e com as sugestões corretas: update de ACT-102 (prazo 06/10 → 09/10, próximo passo "Validar as etapas com Carla") e criação da lista de presença da Carla **sem prazo inventado** ("sem prazo combinado").
- **DN-12 (cópia idêntica):** uma cópia da ata de 04/10 gerou uma segunda sugestão de criação. Defeito real, corrigido (DEC-020): a chave agora usa a evidência literal.
- **CA-F4.4 (conflito):** `Ata_2026-10-06.md` propôs 09/10 para o prazo de ACT-101, já com 07/10 proposto pela ata de 03/10; a página da atividade mostra "Conflito — requer decisão: Prazo 07/10 (Ata_2026-10-03) × 09/10 (Ata_2026-10-06.md)" e o oficial segue 05/10.
- **Custo real acumulado:** 6 chamadas ≈ US$ 0,07 (≈ US$ 0,012 cada).
- **Limite do conector:** cria, renomeia, move e manda para a lixeira, mas não edita o conteúdo de um arquivo. Por isso dependem de edição manual do usuário: (a) editar o texto do Google Doc `Ata_2026-10-03` para ver "fonte alterada" e a substituição da sugestão (V-3 com IA); (b) editar uma célula do `Ata_registro.xlsx` no Drive para ver a diferença do registro com arquivo real.
