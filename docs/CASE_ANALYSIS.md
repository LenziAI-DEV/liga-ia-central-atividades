# CASE_ANALYSIS — Central de contexto e atividades da Liga IA UFSCar

> Etapa 0: entender o desafio. Este documento **não** define stack, arquitetura nem implementação.
> Ele converte o material da banca em especificação rastreável.
> Data da análise: 2026-09-28.

---

## 0. Fontes analisadas e convenção de citação

| Sigla | Arquivo | Páginas/seções | Leitura |
|---|---|---|---|
| **[CA]** | `instrucoes_iniciais/Comece_aqui.pdf` | 1 página | Completa, texto legível |
| **[CASE pN]** | `instrucoes_iniciais/Case_Candidato_tecnico.pdf` | 13 páginas (p.1 capa … p.13 referências) | Completa. Texto e imagem de cada página conferidos. Ver observações em §0.1 |
| **[ESP §N]** | `instrucoes_iniciais/Especificacao_Tecnica_Candidato.pdf` (v1.0, 23/09/2026) | 5 páginas, §1–§11 | Completa, legível (inclui tabelas §2 e §9) |
| **[GUIA §N]** | `instrucoes_iniciais/Guia_Google_Drive_API.pdf` | 8 páginas, §1–§13 | Completa, legível (inclui código §7 e tabela §11) |
| **[LEIA]** | `dados_ficticios/LEIA_ME_PRIMEIRO.md` | — | Completa |
| **[INDEX]**, **[ESTADO]**, **[GUIA_INI]**, **[ATA01]**, **[PLANO]**, **[XLSX]** | `dados_ficticios/01_CARGA_INICIAL/*` | — | Completa (o `.xlsx` foi lido direto do XML interno) |
| **[ATA03]**, **[ATA03d]**, **[ATA04]** | `dados_ficticios/02_ADICIONAR_DEPOIS_DA_CARGA/*` (`.md`, `.docx`, `.md`) | — | Completa |
| **[VAZIA]**, **[CONF]** | `dados_ficticios/03_CONFLITO/*` (`.xlsx`, `LEIA_CONFLITO.md`) | — | Completa |

### 0.1 Observações de legibilidade

- **[CASE p3]**: o texto original traz um erro de digitação: "aprendiza’’os" (seria "aprendizados"). Isso não muda o sentido.
- **[CASE p11]**: o texto extraído traz o cabeçalho "REVISÃO DO CASE", mas a imagem da página mostra "AUTOAVALIAÇÃO". O conteúdo tem duas listas, "REVISÃO • 04–08" e "REVISÃO • 09–13". A numeração continua as 3 perguntas da p.10, então há **13 perguntas de autoavaliação** no total.
- **[CASE p5–p6]**: as tabelas R01–R12 foram conferidas no texto e na imagem. Os dois batem.
- **[XLSX]**: os prazos são números seriais do Excel com formato `yyyy-mm-dd` e valor fracionário `.5`, ou seja, meio-dia. A conversão foi conferida: 46300.5 = 2026-10-05, 46301.5 = 2026-10-06, 46304.5 = 2026-10-09, 46306.5 = 2026-10-11. Esses valores batem com [ATA01].
- **[ATA03d]** (`.docx`): o texto é idêntico ao de [ATA03] (`.md`). A diferença que apareceu no terminal foi só de codificação na exibição, não de conteúdo.
- Nenhuma página ficou ilegível.

---

## 1. Contexto do problema

A Liga registra missão, funcionamento, decisões, atas e atividades em arquivos do Google Drive. Isso preserva o histórico, mas nenhum membro tem uma visão simples do trabalho atual. O enunciado aponta três dificuldades [CASE p2]:

- a informação fica espalhada em vários arquivos;
- uma ata recente pode mudar uma tarefa criada numa reunião anterior;
- dois arquivos parecidos podem ter **autoridade diferente**.

O membro precisa descobrir o que é dele, qual o próximo passo, qual o prazo e **de onde veio** a informação. Duas perguntas guiam o produto [CASE p2]:

1. **"O que preciso fazer agora?"**
2. **"O que mudou desde a última vez que acompanhei a Liga?"**

O case foi inspirado num problema real, mas usa dados fictícios. É proibido usar documentos privados da Liga [CA], [CASE p2], [LEIA].

## 2. Objetivo da aplicação

Uma **central de contexto, onboarding e atividades usada no navegador** [CASE p2], [CA] que:

- orienta quem acabou de chegar ("Comece aqui");
- reúne as atividades da Liga num painel;
- deixa cada membro encontrar as suas tarefas;
- usa **IA** para transformar informação nova dos documentos em **sugestões úteis e verificáveis, sempre com a fonte visível**;
- **lê uma pasta configurada do Drive** e incorpora automaticamente arquivos novos ou alterados dentro do escopo.

Os documentos originais continuam no Drive.

## 3. Usuários / personas

### 3.1 Personas de demonstração (fictícias) [LEIA]

| ID | Nome | Frente | Papel no protótipo | Atividades esperadas após a carga inicial [LEIA passo 3] |
|---|---|---|---|---|
| U-A | Ana | Growth | Membro, responsável por tarefas | ACT-101, ACT-104 |
| U-B | Bruno | Growth | Líder de Growth, **pode revisar sugestões** | — |
| U-C | Carla | Formação | Membro e **revisora de sugestões** | ACT-103 |
| U-D | Davi | Operações | Membro, responsável por tarefas | ACT-102, ACT-104 |

### 3.2 Papéis funcionais exigidos

- **Membro**: vê "Minhas atividades", cria e edita atividades e lê o resumo pessoal [CASE p3], [ESP §5].
- **Revisor/aprovador**: aceita, ajusta ou rejeita sugestões da IA. É preciso representar **pelo menos dois membros e um perfil que aprove** [CASE p8].
- **Membro novo**: alguém que não conhece o acervo e usa "Comece aqui" [ESP §5.F], [ESP §9 "Primeiro acesso"].
- **Banca/avaliador**: instala, executa, conecta a pasta, acrescenta arquivos inesperados no Drive e confere o comportamento [CASE p2, p9, p10, p11].
- **Operador/candidato**: configura credenciais OAuth e a pasta [GUIA].

A identidade pode ser uma autenticação simples de teste ou uma **troca explícita de usuário de demonstração**. Não é preciso ter SSO [CASE p8], [ESP §11].

## 4. Funcionalidades exigidas (visão de produto)

As seções que precisam estar explícitas no primeiro acesso [CASE p8] são:

1. **Comece aqui**: propósito, frentes, regras de trabalho, documentos principais, fonte atual das atividades e primeira ação. Temas não confirmados precisam aparecer como tal [CASE p3 item 1], R12, [ESP §5.F].
2. **Minhas atividades**: tarefas não concluídas do membro, incluindo as compartilhadas, com bloqueios, itens sem prazo e aviso de mudança pendente [ESP §5.A].
3. **Todas as atividades**: lista com filtros por responsável, frente, estado e prazo (R05).
4. **Sugestões para revisar**: fila de propostas da IA com evidência, onde o revisor aceita, ajusta ou rejeita (R07, [ESP §5.D]).
5. **Novidades dos documentos**: o que mudou nas fontes, mais o resumo "o que mudou para mim" (R09, [ESP §5.E]).
6. **Estado da sincronização**: pasta conectada, última sincronização, status de cada arquivo, falhas e botão "sincronizar agora" (R01–R03).

Recursos transversais: detalhe da atividade com descrição, próximo passo, fonte, última atualização e histórico [CASE p3 item 3]; criação e edição de atividades (R06, [ESP §5.B]); troca de usuário de demonstração (R05, [CASE p8]).

---

## 5. Requisitos funcionais

Classificação usada: **EXP** = requisito explícito; **IMP** = requisito implícito (deduzido de exigências explícitas); **REC** = recomendação ou exemplo, não obrigatório.

### 5.1 Integração com o Drive e ingestão

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RF-01 | Conectar uma pasta de teste do Drive com credenciais do próprio candidato. A tela mostra qual pasta está conectada e a data da última sincronização | EXP | R01 [CASE p5]; [ESP §4]; [GUIA §6] |
| RF-02 | Considerar a pasta raiz e **todas as subpastas**, com paginação e sem buscar na conta inteira | EXP | [CASE p4]; [ESP §4 carga inicial 2]; [GUIA §7] |
| RF-03 | Ingerir obrigatoriamente **.md, .xlsx e Google Docs nativos** | EXP | [CASE p4]; [GUIA §8] |
| RF-04 | Para `.md`, preservar o texto e os títulos. Para `.xlsx`, ler as abas e células necessárias. Para Google Docs, usar export ou a Docs API (nunca `alt=media`) | EXP | [ESP §4 carga inicial 3]; [GUIA §8, §11] |
| RF-05 | Formatos fora do escopo (scan/OCR, imagem, vídeo, `.docx` não convertido etc.) aparecem como **"formato ainda não processado"**, com motivo, sem inventar conteúdo | EXP | [CASE p4]; [CASE p12 FAQ PDF]; [GUIA §8] |
| RF-06 | Carga inicial mostra o estado de cada arquivo: **processado / falho / ignorado**, com contagens. Os links abrem a origem no Drive | EXP | R02; [ESP §4 carga inicial 4] |
| RF-07 | Uma falha isolada não interrompe o resto da carga | EXP | [ESP §4 carga inicial 4] |
| RF-08 | **Detecção automática** de arquivos novos e edições, visível em **≤ 15 min** com o app rodando, sem upload pela UI | EXP | R03; [ESP §4 incremental]; [GUIA §6.7, §9] |
| RF-09 | Botão "sincronizar agora", que **não** substitui o mecanismo automático | EXP | R03; [ESP §4]; [GUIA §9] |
| RF-10 | "Atualizar só quando o usuário cola um link" **não atende** o R03 | EXP | [CASE p7] |
| RF-11 | **Idempotência**: o mesmo evento recebido duas vezes não gera sugestão, atividade ou documento duplicado. Usar `file_id` mais versão ou hash | EXP | [ESP §4]; [GUIA §6, §9.6] |
| RF-12 | Arquivo **renomeado** mantém o identificador | EXP | [ESP §4] |
| RF-13 | Arquivo **removido ou com acesso revogado** é marcado como indisponível/desatualizado, sem mostrar cache como confirmado | EXP | [ESP §4]; [GUIA §9.7]; [CASE p7] |
| RF-14 | Ata **editada**: reprocessar a nova versão, comparar resultados, marcar para revisão ou substituir as sugestões que dependiam da versão antiga | EXP | [ESP §4] |
| RF-15 | Expor o estado da sincronização, o último sucesso e as falhas | EXP | [ESP §4]; [GUIA §6] |
| RF-16 | Cada item extraído guarda **identificador, link, nome, tipo, data de modificação e referência à versão processada** | EXP | [CASE p4]; [ESP §2 Fonte] |
| RF-17 | Nunca tratar falha ou timeout como ausência de atividade. Nunca marcar um arquivo como vazio porque a leitura falhou | EXP | [ESP §4 limites]; [GUIA §8] |
| RF-18 | Filtrar eventos do `changes.list` pela árvore da pasta e manter o vínculo local entre arquivo e pasta, para tratar remoções sem pais | REC (forte) | [GUIA §9] |
| RF-19 | O escopo da pasta monitorada aparece **no produto** e no README | EXP | [CASE p12 FAQ] |
| RF-20 | Não mover, renomear nem apagar documentos de entrada. Não escrever no Drive | EXP | [ESP §1]; [ESP §7] |

### 5.2 Atividades

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RF-21 | Exibir atividade com **título, responsável(is), frente, estado, prazo, próximo passo e fonte** | EXP | R04 |
| RF-22 | Responder "o que eu preciso fazer e até quando?" **em poucos cliques**. Dono e prazo visíveis sem uma cadeia de telas | EXP | R04; [CASE p8] |
| RF-23 | Filtros: **minhas, todas, responsável, frente, estado, prazo** | EXP | R05; [CASE p3 item 3] |
| RF-24 | Trocar o usuário de demonstração muda "minhas" **sem mudar os dados** | EXP | R05 |
| RF-25 | "Minhas atividades" mostra as não concluídas do membro, inclusive as compartilhadas, ordenáveis por prazo, com bloqueios, itens sem prazo ("a definir") e aviso de mudança pendente | EXP | [ESP §5.A] |
| RF-26 | **ACT-104 conta como uma atividade só**, mesmo aparecendo para duas pessoas (vários responsáveis) | EXP | [ESP §5.A]; [CASE p7]; [XLSX] |
| RF-27 | Preservar a atividade bloqueada (ACT-103) e a de dois responsáveis (ACT-104) | EXP | [CASE p7] |
| RF-28 | **Criar** atividade pela UI (título, descrição breve, frente, responsável, próximo passo, estado, prazo opcional). Ela é salva com ID, autoria, horário e indicação de **criação manual** | EXP | R06; [ESP §5.B] |
| RF-29 | **Editar**, concluir e bloquear atividade pela UI | EXP | R06; [ESP §5.B] |
| RF-30 | Persistir **após recarregar a página e reiniciar a aplicação** | EXP | [CASE p3 item 4]; R06; [CASE p10] |
| RF-31 | Histórico com **autor, hora, campos alterados (antes/depois), motivo e fonte quando houver** | EXP | R06; [ESP §2 Evento]; [ESP §5.B] |
| RF-32 | Estados mínimos: **a fazer, em andamento, bloqueada, concluída** | EXP | [CASE p8] |
| RF-33 | Campos vazios não são preenchidos por IA sem confirmação | EXP | [ESP §5.B] |
| RF-34 | Detalhe da atividade: descrição, próximo passo, fonte, última atualização, histórico e links às fontes | EXP | [CASE p3 item 3]; [ESP §5.A] |
| RF-35 | Uma **regra única e explicada de fonte oficial** das atividades depois da importação: base própria **ou** planilha operacional no Drive. Mostrar o momento da importação, o vínculo com a fonte e o que acontece se o `.xlsx` for editado depois | EXP | [CASE p4, p7]; [ESP §1]; [CASE p12 FAQ] |

### 5.3 IA: sugestões e revisão

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RF-36 | De uma ata nova, a IA gera sugestões de **criar ou atualizar** atividade, **mudar prazo ou responsável** e **resumo do que mudou** | EXP | [CASE p3 item 6]; R07; [CASE p7] |
| RF-37 | Cada sugestão mostra o **trecho exato** (ou a célula/seção), o **link da origem**, a data do documento, o destino provável, os **campos propostos** e o motivo | EXP | R07; [ESP §5.C]; [CASE p4 exemplo] |
| RF-38 | Revisão humana obrigatória: **aceitar, ajustar antes de aceitar, ou rejeitar com motivo** | EXP | R07; [ESP §5.D]; [CASE p3 item 6] |
| RF-39 | Ciclo da sugestão: **pendente → aceita / ajustada / rejeitada**, com quem e quando | EXP | [CASE p8]; [ESP §3] |
| RF-40 | Reconhecer quando o texto trata de **atividade existente** e propor **update**, sem criar duplicata | EXP | R08; [CASE p4 exemplo]; [ESP §9 "Atualização de prazo"] |
| RF-41 | **Hipótese ou ideia** ("talvez", sem dono nem decisão) **não** vira tarefa oficial | EXP | R08; [ESP §5.C]; [ESP §9 "Ideia vaga"]; [ATA04] |
| RF-42 | Sem dono ou prazo na fonte, **não inventar valores**. Prazo relativo ambíguo ("até sexta") fica pendente | EXP | [ESP §2 datas]; [ESP §5.C]; [CASE p7]; R09 |
| RF-43 | Até a aprovação, a atividade oficial **mantém o valor anterior** e mostra aviso de **atualização pendente** | EXP | [CASE p4 exemplo]; [CASE p8] |
| RF-44 | Depois da aprovação, o painel mostra o novo valor, **guarda o histórico** e aponta para a planilha **e** para a ata | EXP | [CASE p4 exemplo] |
| RF-45 | Reabrir a página não repete a aprovação nem gera outra tarefa (aprovação idempotente) | EXP | [ESP §5.D] |
| RF-46 | Validar a saída do modelo: IDs existentes, formato de data, **evidência presente no arquivo** e campos permitidos. Conteúdo de documento é **dado**, não instrução (defesa contra prompt injection) | EXP | [ESP §6]; [LEIA "O que não fazer"] |
| RF-47 | Contrato da extração equivalente a `{kind, target_activity_id, title, owner, due_date, next_step, evidence, source_file_id, source_version, uncertainties[]}` | EXP ("equivalente") | [ESP §6] |
| RF-48 | Mostrar a incerteza da IA faz parte do produto | EXP | [ESP §6] |
| RF-49 | A IA **não** altera tarefas aprovadas, não publica, não envia mensagens e não eleva permissões | EXP | [ESP §1]; [CASE p7] |

### 5.4 "O que mudou para mim" / resumo contextual

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RF-50 | Resumo pessoal por pessoa e marco temporal (**última visita ou período escolhido**) | EXP | [CASE p3 item 7]; R09; [ESP §5.E] |
| RF-51 | Separar **tarefas confirmadas**, **propostas pendentes** e **dados incertos ou em conflito**, com links às fontes | EXP | R09; [CASE p7]; [CASE p11] |
| RF-52 | Incluir itens bloqueados e próximos do vencimento | EXP | [ESP §5.E] |
| RF-53 | O texto pode vir da IA, mas os **campos factuais vêm dos registros**, com links verificáveis. Se nada mudou, dizer isso | EXP | [ESP §5.E] |
| RF-54 | Pessoas diferentes recebem resumos diferentes (Ana vê a mudança de ACT-101, Davi não) | EXP | [ESP §9 "Resumo pessoal"] |
| RF-55 | O resumo não expõe texto que o membro não poderia ver | EXP | [ESP §7] |

### 5.5 Conflitos e autoridade

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RF-56 | Uma planilha **vazia e de nome parecido** não apaga as atividades da fonte vigente. O conflito ou descarte fica visível e pede decisão humana | EXP | R10; [ESP §3]; [ESP §9 "Arquivo homônimo"]; [CONF] |
| RF-57 | Implementar, documentar e apresentar uma **regra de precedência** (o exemplo de [ESP §3] é defensável, mas não obrigatório) | EXP | [ESP §3]; [ESP §1] |
| RF-58 | Colisões que não se resolvem com segurança viram **pendência humana** | EXP | [ESP §3]; [INDEX] |
| RF-59 | Documentos antigos ou superados (ex.: `PLANO_EDITORIAL_ANTIGO.md`, `status: deprecated`) não são mostrados como norma atual | EXP (dados) | [INDEX]; [PLANO]; [GUIA_INI]; [ESP §3 item 4] |
| RF-60 | Não tratar o arquivo mais recente como mais confiável **só pela data** | EXP | [LEIA] |

### 5.6 Onboarding ("Comece aqui")

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RF-61 | Página com síntese do **propósito**, explicação das **frentes**, **regras de trabalho**, links aos **documentos de referência**, **fonte atual das atividades**, como achar tarefas pessoais e **primeira ação** do membro | EXP | [CASE p3 item 1]; R12; [ESP §5.F] |
| RF-62 | Campos provisórios ou "a confirmar" (ex.: missão provisória em [ESTADO]) aparecem **como parciais**. Não inventar missão nem organograma oficial | EXP | R12; [ESP §5.F]; [ESTADO] |
| RF-63 | Baseado nos **arquivos de direção fornecidos** (INDEX, ESTADO-ATUAL, GUIA_INICIAL) | EXP | R12 |
| RF-64 | Página simples, com links e 3–4 passos, **sem** curso, trilha ou sistema de progresso | EXP (limite) | [CASE p8]; [ESP §5.F] |

---

## 6. Requisitos não funcionais

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RNF-01 | Interface legível em **desktop e celular**. Prazo, dono e ação de revisão continuam visíveis na tela estreita | EXP | R11; [ESP §8]; [CASE p8] |
| RNF-02 | **Navegação por teclado**, ordem de tabulação lógica e **foco visível** | EXP | R11; [ESP §8]; [CASE p8] |
| RNF-03 | Formulários com **rótulos** e **indicação de erro em texto** | EXP | R11; [ESP §8] |
| RNF-04 | Estado **não depende só de cor** (nem de um ponto colorido isolado) | EXP | R11; [ESP §8] |
| RNF-05 | Contraste de texto **≥ 4,5:1** (WCAG 2.2) | EXP | [CASE p8]; [ESP §8] |
| RNF-06 | Identidade: azul **#1433BD** (principal), ciano **#19DCE3** (acento), preto e branco como base. O ciano leva texto escuro | EXP | [CASE p8]; [ESP §8]; [GUIA_INI] |
| RNF-07 | Estilo sóbrio, editorial, voltado à leitura, **sem cara de chatbot genérico**. Organização vale mais que animação | EXP | [CASE p8]; [ESP §8] |
| RNF-08 | A primeira tela traz a informação operacional essencial | EXP | [ESP §8] |
| RNF-09 | Tratar **estado vazio, documento com erro, carregamento, conexão perdida e uso no celular** | EXP | [CASE p8] |
| RNF-10 | **Resiliência**: com API ou modelo fora do ar, mostrar o último estado confirmado marcado como desatualizado, permitir nova tentativa e manter as ações manuais | EXP | [CASE p12 FAQ]; [ESP §9 "Erro de fonte"] |
| RNF-11 | Retry com **atraso progressivo** para erros temporários (401/403/429) | REC (forte) | [GUIA §9, §11] |
| RNF-12 | Datas mostradas no fuso **America/Sao_Paulo** e guardadas de forma inequívoca (ISO `AAAA-MM-DD` ou timestamp com fuso) | EXP | [ESP §2]; [LEIA] |
| RNF-13 | Prazos vencidos aparecem como **vencidos**. Não mudar datas para parecerem futuras | EXP | [LEIA] |
| RNF-14 | Guardar o **mínimo** de conteúdo extraído e explicar como limpar e invalidar o cache após exclusão ou revogação | EXP | [ESP §7]; [GUIA §12] |
| RNF-15 | Roda **localmente**, com instalação em poucos comandos. Hospedagem não é necessária | EXP | [CASE p3]; [CASE p9]; [CASE p12] |

## 7. Requisitos técnicos e de segurança

| ID | Requisito | Tipo | Fonte |
|---|---|---|---|
| RT-01 | Nenhuma stack é obrigatória | EXP | [CASE p10]; [ESP §10]; [GUIA §13] |
| RT-02 | OAuth 2.0 **authorization code flow** no servidor (cliente "Web application"), validação de `state` (CSRF) e biblioteca oficial ou consolidada | REC (forte) | [GUIA §3, §10] |
| RT-03 | Escopo **`drive.readonly`**, o mínimo que permite detectar arquivos novos na pasta. **Não** usar `drive` (escrita). `drive.file` provavelmente não atende o R03 | REC (forte; conclusão do guia) | [GUIA §5] |
| RT-04 | App OAuth em modo **External/Testing**, com a própria conta como test user. O **refresh token expira em 7 dias** | EXP (fato operacional) | [GUIA §2] |
| RT-05 | **Proibido** usar service account ou chaves privadas | EXP | [GUIA §10] |
| RT-06 | Segredos e tokens só no servidor (variáveis de ambiente ou armazenamento seguro). `.env`, `client_secret*.json` e tokens ficam no `.gitignore`. Nada de segredo no JS do navegador, logs, README, PDF ou vídeo | EXP | R01; [CASE p3]; [ESP §7]; [GUIA §4, §10] |
| RT-07 | Não registrar em log códigos OAuth, tokens nem URLs completas de autorização | EXP | [GUIA §10] |
| RT-08 | ID da pasta raiz vem da configuração (ex.: `DRIVE_TEST_FOLDER_ID`), não de busca pelo nome | REC | [GUIA §6.4, §10] |
| RT-09 | Listagem com `files.list` (`'<id>' in parents and trashed=false`), paginação por `nextPageToken`, descida recursiva nas subpastas e conjunto de IDs já visitados | REC (forte) | [GUIA §7] |
| RT-10 | Checar `capabilities.canDownload` antes de ler. `.md`/`.xlsx` via `files.get alt=media`. Google Docs via `files.export` (limite de **10 MB**) ou `documents.get` | REC (forte) | [GUIA §8] |
| RT-11 | Sync incremental: `changes.getStartPageToken` guardado **antes** da carga inicial, `changes.list` paginado, gravação de `newStartPageToken`. Reconciliação periódica por varredura completa | REC | [GUIA §9]; [ESP §10] |
| RT-12 | Webhook (`changes.watch`) **não** é exigido. A notificação só avisa, e o detalhe vem do `changes.list` | EXP | [CASE p7]; [ESP §4, §10] |
| RT-13 | `md5Checksum` pode não existir em arquivos nativos do Workspace. É preciso outra estratégia de versão (ex.: `version`/`modifiedTime`/hash do texto exportado) | IMP | [GUIA §7] |
| RT-14 | Persistência com entidades equivalentes a **Fonte, Membro, Atividade, Referência, Sugestão e Evento de atividade** (campos mínimos em [ESP §2]) | EXP | [ESP §2] |
| RT-15 | Não é obrigatório usar chatbot, RAG, embeddings, agentes nem MCP. "Não há prêmio" por usar sem necessidade. Extração determinística pode conviver com IA | EXP | [CASE p7]; [CASE p12] |
| RT-16 | Serviço externo de IA: proteger as chaves e mandar só os dados fictícios | EXP | [CASE p7]; [GUIA §10] |
| RT-17 | Ações externas (escrever no Drive, notificar, mandar mensagem, publicar, mudar permissões) ficam **fora do escopo** | EXP | [ESP §7, §11] |
| RT-18 | Na implantação real, respeitar as permissões do Drive por pessoa: descrever no README o caminho de autenticação e controle de acesso e o que falta no protótipo | EXP | [CASE p8]; [ESP §7] |

### 7.1 Modelo conceitual mínimo [ESP §2] (nomes podem mudar; a informação equivalente é obrigatória)

| Entidade | Campos mínimos |
|---|---|
| Fonte | file_id, name, mime_type, web_url, modified_at, version_or_hash, path, sync_status, last_processed_at |
| Membro | member_id, display_name, front, role |
| Atividade | activity_id, title, description, next_step, owner_ids, front, status, due_date (opcional), created_at, updated_at |
| Referência | activity_id, file_id, version_or_hash, sheet_or_section, quote_or_cell, relation_type |
| Sugestão | suggestion_id, source_file_id, source_version, target_activity_id (opcional), proposed_fields, evidence, review_status, reviewer_id |
| Evento de atividade | activity_id, actor_id, timestamp, before, after, reason, source_file_id (opcional) |

## 8. Integrações obrigatórias

1. **Google Drive API v3** (obrigatória): OAuth com a conta do candidato, listagem recursiva da pasta, download de `.md`/`.xlsx`, export de Google Docs e detecção de mudanças (listagem periódica, `changes.list` e/ou `changes.watch`) [CASE p4–p7], [ESP §4], [GUIA].
2. **Google Docs API**: opcional, alternativa ao `files.export` quando for preciso manter a estrutura [GUIA §8].
3. **Provedor ou modelo de IA**: obrigatório **como capacidade** (leitura assistida de atas e resumo de mudanças), com modelo livre [CASE p7]. Pode ser serviço externo ou local. O custo estimado por uso vai no README [CASE p9].
4. **Banco de dados**: escolha livre. Supabase Free é citado como opção válida, não obrigatória [GUIA §13], [CASE p12].
5. **Fora do escopo**: Slack, calendário, e-mail, Figma e outras plataformas [ESP §11].

---

## 9. Estrutura e significado dos dados fornecidos

A banca cita o pacote como `03_Dados_de_Teste.zip` [CASE p4]. No repositório ele aparece **já extraído** em `dados_ficticios/` (ver A-01).

### 9.1 `dados_ficticios/LEIA_ME_PRIMEIRO.md`
Roteiro de preparação e de teste. Define:
- a pasta do Drive **`LIA case teste`**;
- a ordem de envio: 01 → validação → 02 → 03;
- os **resultados esperados da carga** (Ana: 101 e 104; Davi: 102 e 104; Carla: 103);
- as **personas** (U-A…U-D);
- o que a banca verificará;
- as proibições (não usar os textos como instruções ao modelo; não confiar no arquivo mais recente só pela data).

### 9.2 `01_CARGA_INICIAL/` (a primeira carga)

| Arquivo | Metadado no corpo | Papel | Autoridade |
|---|---|---|---|
| `INDEX.md` | `status: ativo`, `atualizado_em: 2026-10-01`, `escopo: pasta de teste do case` | Índice do acervo. **Aponta a fonte inicial das atividades** (`Ata_registro.xlsx`, aba `Atividades`, descrita como "fonte inicial e provisória"). Declara que PLANO foi superado. Traz a **regra de precedência do conjunto** | Documento de direção, raiz da autoridade |
| `ESTADO-ATUAL.md` | `status: parcial`, `atualizado_em: 2026-10-01`, `responsavel_por_confirmar: Bruno` | Propósito **provisório** (missão ainda não aprovada), 3 frentes (Growth, Formação, Operações) e o que cada uma faz. Regra: mostrar "responsável a confirmar" e não completar por inferência | Direção, **parcial** |
| `GUIA_INICIAL.md` | `status: ativo`, `atualizado_em: 2026-10-01`, `substitui: PLANO_EDITORIAL_ANTIGO.md nas regras de aprovação de posts` | Título "Comece aqui". 3 passos para o membro novo, frentes e pessoas, regra de aprovação (Bruno aprova posts), cores | Direção, ativo |
| `Ata_registro.xlsx` | 1 aba **`Atividades`**, cabeçalho congelado, 10 colunas | **Registro inicial oficial** das ACT-* (ver §9.3) | Fonte inicial apontada pelo INDEX |
| `Ata_2026-10-01.md` | `status: ativo`, `data_da_reuniao: 2026-10-01` | Origem histórica das decisões ACT-101…104. Os dados **batem** com o xlsx. Diz que o registro operacional é o xlsx | Contexto histórico. **Não** deve gerar sugestões duplicadas na carga |
| `PLANO_EDITORIAL_ANTIGO.md` | `status: deprecated`, `criado_em: 2026-09-16`, `substituido_por: GUIA_INICIAL.md em 2026-10-01` | Regra antiga (publicar notícias todo dia, Carla aprova posts). **Armadilha**: não apresentar como norma atual | Histórico, sem autoridade |

Observação: os metadados (`status:` etc.) são linhas comuns no corpo do Markdown, terminadas em dois espaços. **Não** são front-matter YAML (não há `---`).

### 9.3 `Ata_registro.xlsx`, aba `Atividades`

Colunas: `ID | Atividade | Responsáveis | Prazo | Frente | Prioridade | Status | Próximo passo | Origem | Notas e bloqueios`

| ID | Atividade | Responsáveis | Prazo | Frente | Prior. | Status | Próximo passo | Origem | Notas e bloqueios |
|---|---|---|---|---|---|---|---|---|---|
| ACT-101 | Preparar carrossel sobre ferramentas | Ana | 2026-10-05 | Growth | Alta | Em andamento | Preparar roteiro e selecionar exemplos | Ata_2026-10-01.md | Versão final depende de aprovação do líder de Growth |
| ACT-102 | Montar checklist inicial de onboarding | Davi | 2026-10-06 | Operações | Alta | A fazer | Revisar material de entrada e propor primeira versão | Ata_2026-10-01.md | Validar etapas com alguém de Operações |
| ACT-103 | Elaborar briefing de oficina | Carla | 2026-10-09 | Formação | Média | **Bloqueada** | Obter confirmação do espaço | Ata_2026-10-01.md | Sala ainda não confirmada |
| ACT-104 | Revisar fluxo de solicitação de materiais | **Ana; Davi** | 2026-10-11 | Operações | Média | A fazer | Mapear etapas atuais | Ata_2026-10-01.md | Uma tarefa com dois responsáveis |

Particularidades para a extração:
- responsáveis aparecem por **nome de exibição**, não por ID (U-A…), e são separados por `"; "`;
- os prazos são datas seriais do Excel com hora 12:00, não texto;
- os status vêm em português com maiúscula inicial;
- `Origem` guarda o **nome** do arquivo, não o `file_id`;
- as colunas `Prioridade` e `Notas e bloqueios` **não constam** do modelo mínimo [ESP §2]. Não são exigidas, mas convém preservá-las (ver D-06);
- nenhuma atividade está "Concluída";
- a Ana é de Growth mas também é responsável por ACT-104 (Operações). A frente é da **atividade**, não da pessoa.

### 9.4 `02_ADICIONAR_DEPOIS_DA_CARGA/` (cenários incrementais)

| Arquivo | Conteúdo | Resultado esperado |
|---|---|---|
| `Ata_2026-10-03.docx` | Mesmo texto do `.md`. Deve ser enviado e **convertido em Google Docs nativo** no Drive [LEIA passo 4] | Testar a ingestão de Google Docs nativo |
| `Ata_2026-10-03.md` | Cópia de conferência. **Não enviar junto** com a versão Docs, para não duplicar [LEIA] | — |
| (conteúdo da ata de 03/10) | ACT-101 continua com Ana. Prazo **2026-10-05 → 2026-10-07**. "Bruno aprovará a versão final". Próximo passo: "fechar o roteiro e enviar para Bruno". O prazo antigo fica no histórico | **Sugestão de UPDATE em ACT-101** (due_date, next_step), com evidência. **Sem** tarefa nova. **Sem** trocar o responsável para Bruno. O oficial só muda após aprovação (é o cenário do exemplo em [CASE p4]) |
| `Ata_2026-10-04.md` | (a) **Nova decisão**: Carla revisará a pauta da primeira oficina e entregará uma proposta de exercício prático até **2026-10-10**. Próximo passo: escolher um problema real simples. (b) **Ideia sem decisão**: "Talvez possamos publicar uma série diária de notícias sobre IA. Ninguém assumiu…" | (a) **Sugestão de CREATE** (dono Carla, prazo 2026-10-10; a frente é **inferível**, não explícita, ver A-09). Atenção à possível relação com ACT-103 (ver A-08). (b) **no_action**: não vira tarefa. Ela repete a regra do PLANO antigo, uma armadilha dupla |

### 9.5 `03_CONFLITO/`

| Arquivo | Conteúdo | Resultado esperado |
|---|---|---|
| `Ata - copia vazia.xlsx` | O mesmo cabeçalho de 10 colunas do registro, **aba chamada `Ata`** (não `Atividades`), uma linha de dados com células vazias | **Não** zerar nem apagar atividades. Mostrar o arquivo como conflito ou "ignorado/sem autoridade", com o motivo visível. Não foi apontado pelo INDEX |
| `LEIA_CONFLITO.md` | Instrução ao candidato. Diz que o arquivo é "mais recente" e que "o resultado correto não é zerar a lista" | Instrução, **não** material para enviar ao Drive (ver A-03) |

### 9.6 Outros materiais no repositório
- `.claude/settings.local.json`: configuração local da ferramenta. **Não** é material da banca.
- Não há mais arquivos de dados, imagens ou planilhas.

---

## 10. Critérios de avaliação da banca

### 10.1 Pesos [CASE p10]

| Dimensão | Peso | Evidência esperada |
|---|---|---|
| Entendimento do problema e fonte oficial | **15** | Representar o funcionamento da Liga sem perder contexto e sem criar "duas verdades silenciosas" |
| Integração e atualização do Drive | **20** | Carga inicial, arquivos novos e alterados, proveniência, tratamento de erros |
| Gestão de atividades | **20** | Visão pessoal, filtros, edição pela UI, persistência, autoria e histórico |
| Uso útil e confiável de IA | **20** | Sugestões com evidência, revisão humana, resumo contextual, limites reconhecidos |
| Experiência e acessibilidade | **15** | Fluxos claros, marca da Liga, leitura, contraste, celular e teclado |
| Validação e passagem de bastão | **10** | Testes relevantes, README reproduzível, explicação honesta de limites e decisões |

Princípios declarados [CASE p10]:
- a banca aplicará **cenários novos da mesma natureza**;
- não existe stack nem arquitetura única correta;
- **uma solução menor que resolve os fluxos centrais corretamente pode valer mais** que uma interface extensa com informação errada.

Os requisitos obrigatórios estão em [CASE p5–p6].

### 10.2 Perguntas de autoavaliação [CASE p10–p11]
1. O membro identifica suas atividades, responsável e prazo sem perguntar a outra pessoa?
2. Quem acabou de entrar entende a Liga, acha os documentos básicos e descobre sua primeira ação sem ler todo o Drive?
3. Uma atividade criada pela UI continua lá após recarregar e reiniciar?
4. Um arquivo novo no Drive é descoberto automaticamente dentro do prazo?
5. Uma edição em documento já conhecido atualiza a informação sem duplicá-lo?
6. Uma ata que muda o prazo produz sugestão de atualização, sem uma segunda tarefa?
7. A IA deixa claro o trecho que fundamenta cada sugestão e permite corrigir ou rejeitar?
8. Uma ideia hipotética fica fora do quadro oficial?
9. Uma fonte nova, vazia ou contraditória não apaga silenciosamente a fonte vigente?
10. O resumo pessoal distingue tarefas aprovadas de mudanças pendentes?
11. O sistema mostra quando não conseguiu ler um arquivo ou sincronizar?
12. A interface é limpa, responsiva e usável com teclado, com o azul e o ciano da Liga em contraste adequado?
13. Outro integrante consegue instalar, conectar uma pasta e entender as limitações sem falar com o candidato?

### 10.3 Critérios de aceite executáveis [ESP §9]

| Cenário | Preparação | Resultado mínimo |
|---|---|---|
| Visão pessoal | Entrar como Ana e como Davi | Cada um vê suas atividades, prazos e bloqueios sem confundir responsáveis |
| Upload novo | Ata Google Docs ou .md na pasta | Processada em ≤15 min sem UI; sugestão relevante pendente |
| Edição | Alterar documento conhecido | Versão nova detectada; sem documentos duplicados |
| Atualização de prazo | Ata nova altera ACT-101 | IA oferece edição do registro existente com evidência; aprovação altera o oficial |
| Arquivo homônimo | Planilha vazia "Ata - copia vazia" | Tarefas permanecem; conflito ou descarte mostrado |
| Atividade manual | Criar tarefa e reiniciar | Persiste com autor e histórico |
| Ideia vaga | "talvez", sem dono nem decisão | Não vira atividade oficial |
| Erro de fonte | Retirar acesso ou simular erro | Aviso; estado confirmado marcado como potencialmente desatualizado |
| Resumo pessoal | Mudança relevante para Ana e não para Davi | Resumos diferentes, com fontes e estado de aprovação |
| Primeiro acesso | Membro novo sem orientação oral | Acha propósito, frentes, fonte das tarefas e primeiro passo; lacunas identificadas |

### 10.4 O que a banca verificará com os dados [LEIA]
Leitura inicial, arquivo novo, edição de arquivo conhecido, proposta de mudança em atividade, tarefa nova, hipótese que não vira tarefa e proteção contra perda por arquivo homônimo, **além de casos novos da mesma natureza**.

### 10.5 Na demonstração [CASE p9]
Uma alteração no Drive, uma atividade criada na interface e uma sugestão de IA revisada. A banca **poderá trazer um arquivo inesperado**.

---

## 11. Restrições

| # | Restrição | Fonte |
|---|---|---|
| C-01 | Só dados fictícios. Proibido usar documentos, credenciais ou Drive real da Liga | [CA]; [CASE p2, p12]; [ESP §7]; [GUIA intro]; [LEIA] |
| C-02 | Só leitura no Drive. Não mover, renomear, apagar nem escrever (conflito parcial com [CASE p7], ver A-05) | [ESP §1, §7]; [GUIA §5] |
| C-03 | Escopo limitado à pasta raiz e às subpastas | [CASE p4]; [GUIA §7] |
| C-04 | Sem credenciais no repositório, na tela, nos logs, no README ou no vídeo | R01; [CASE p3]; [GUIA §10] |
| C-05 | Sem service account | [GUIA §10] |
| C-06 | IA nunca oficializa nada sozinha | [CASE p7, p8, p12]; [ESP §1] |
| C-07 | Prazo: ~1 semana ("até o fim do sétimo dia após receber o case"). A data final será comunicada. Entrega até 23h59 de Brasília | [CA]; [CASE p9] |
| C-08 | Entrega do link do GitHub pelo WhatsApp informado no `Comece_aqui.pdf` (atualizado: no privado ao organizador, com a conta `LunkiBR` como colaboradora; DEC-004) | [CA]; [CASE p3] |
| C-09 | Não basta vídeo com telas estáticas: o sistema precisa funcionar | [CASE p12] |
| C-10 | A demonstração não pode depender da conta pessoal aberta no navegador da banca | [CASE p9] |
| C-11 | Ferramentas de IA para desenvolver são permitidas, mas o candidato precisa entender e explicar o que construiu | [CA]; [CASE p2, p9] |

## 12. Entregáveis esperados

| # | Entregável | Conteúdo mínimo | Fonte |
|---|---|---|---|
| E-01 | **Repositório GitHub** com o código-fonte e os arquivos necessários para entender e testar | Sem segredos | [CA]; [CASE p3, p9] |
| E-02 | **README** | Arquitetura em linguagem simples · **decisão sobre a fonte oficial das atividades** · credenciais e pasta do Drive · comandos de instalação e execução · processo de sincronização (intervalo, falhas, arquivo renomeado, removido ou sem acesso) · formatos suportados · **custo estimado por uso** · limitações conhecidas · **medidas antes de usar dados reais** (autenticação e controle de acesso coerentes com o Drive) · escopo da pasta monitorada · como limpar o cache | [CASE p3, p7, p8, p9, p12]; [ESP §7] |
| E-03 | **Diário de bordo** | Tentativas e resultados, decisões e porquês, ferramentas de IA e fontes, como conferiu ou corrigiu as saídas, testes, fora de escopo, limitações, próximos passos. Sem conversas completas, sem credenciais | [CASE p3] |
| E-04 | **Registro de validação** | **≥ 5 casos**: entrada, resultado esperado, resultado observado, correções. Incluir obrigatoriamente **conflito**, **dado ausente** e **arquivo adicionado ao Drive** | [CASE p9] |
| E-05 | **Demonstração** de 5 a 8 minutos (ao vivo ou gravada) + conversa | Alteração no Drive, atividade criada na UI, sugestão de IA revisada, preparo para arquivo inesperado | [CASE p9] |
| E-06 | **Demo acessível** | Link funcional quando possível, ou roteiro local em poucos comandos | [CASE p9] |
| E-07 | **Declaração de IA** | Ferramentas de IA usadas **para construir** e **dentro** do produto, mais **uma decisão alterada depois de achar uma saída incorreta do modelo** | [CASE p9] |
| E-08 | Caminho para produção (autenticação e controle de acesso) descrito no README | — | [CASE p8]; [ESP §7] |

## 13. Itens opcionais / diferenciais

| Item | Status | Fonte |
|---|---|---|
| **PDF com texto selecionável** | Diferencial explícito, **desde que o básico esteja correto** | [CASE p4, p12]; [GUIA §8] |
| Notificações push (`changes.watch`) | Opcional, exige infraestrutura e renovação | [CASE p7]; [ESP §4, §10]; [GUIA §9] |
| Google Docs API (estrutura) | Opcional | [GUIA §8] |
| Link hospedado | Opcional ("quando possível") | [CASE p3, p9, p12] |
| Documentos de teste extras criados pelo candidato | Permitido | [CASE p4] |
| **Não** são diferenciais: chatbot, RAG, busca livre, agentes, MCP, embeddings | Explicitamente fora do escopo ou sem prêmio | [CASE p7, p12]; [ESP §1, §11] |
| Fora do escopo: OCR, imagem, vídeo, produção, Slack, e-mail e similares, lembretes e publicação, autenticação completa, migração do acervo | — | [ESP §11] |

---

## 14. Ambiguidades, contradições e perguntas abertas

| # | Ponto | Detalhe | Impacto / proposta |
|---|---|---|---|
| **A-01** | Nomes dos arquivos | [CASE p4] cita `03_Dados_de_Teste.zip` e [ESP] cita `01_Case_Candidato`. No repositório existem `dados_ficticios/` e `Case_Candidato_tecnico.pdf` | Baixo. São os mesmos materiais, renomeados ou extraídos |
| **A-02** | **Regra de precedência diverge** | [ESP §3]: UI aprovada > proposta de ata > registro inicial > rascunhos. [INDEX]: UI aprovada > **proposta de ata pendente** > **estado atual documentado** > fonte ativa do índice > antigo. O INDEX põe a **proposta pendente acima** da planilha, o que parece contradizer [CASE p4] ("até a aprovação, a atividade oficial continua com o prazo anterior") e [CASE p8] ("documentos novos não alteram silenciosamente…") | **Alto.** Interpretação proposta: a proposta pendente tem precedência **de exibição** (aviso de pendência), não de **valor oficial**. Não está claro o que "estado atual documentado" significa (ESTADO-ATUAL.md? o último estado da base?). Documentar a regra escolhida |
| **A-03** | `LEIA_CONFLITO.md` vai ao Drive? | [LEIA passo 5] manda enviar "a planilha vazia de 03_CONFLITO". `LEIA_CONFLITO.md` é instrução ao candidato | Baixo. Supor que só o `.xlsx` vai. Se o `.md` for, o sistema não pode tratá-lo como fonte de autoridade |
| **A-04** | Entrega: GitHub ou zip? | [CA]: "exclusivamente pelo link do repositório GitHub". [CASE p9]: "repositório ou arquivo compactado" | Baixo. Seguir o GitHub, que é mais restritivo |
| **A-05** | Gravar no Drive? | [CASE p7] admite "planilha operacional no Drive" com gravação sem sobrescrever o histórico. [ESP §7] diz que "ações externas de escrita no Drive" ficam **fora do escopo**, e [GUIA §5] recomenda o escopo **readonly** | Médio. Na prática, favorece a **base própria**. É decisão nossa (D-01) |
| **A-06** | Como a banca testa "arquivo inesperado" | [CASE p2]: a banca poderá "testar arquivos novos na pasta de demonstração conectada pelo candidato". [CASE p9]: não depender da conta pessoal aberta no navegador da banca. Não está dito se a banca **roda localmente com credenciais próprias** (e sua própria pasta) ou se o candidato **compartilha a pasta** ou faz a demo ao vivo | **Alto.** Afeta setup, README e OAuth. **Pergunta para a banca**. Proposta: suportar os dois (README para credenciais próprias + demo ao vivo com a nossa pasta, compartilhada com edição se pedirem) |
| **A-07** | Expiração do refresh token (7 dias em Testing) | Coincide com a duração do case e com a janela de avaliação [GUIA §2] | Médio. Documentar a reautorização e mostrar erro de autenticação de forma visível |
| **A-08** | ATA04 "revisar pauta da primeira oficina": create ou update de ACT-103? | ACT-103 = "Elaborar briefing de oficina" (Carla, bloqueada, Formação). A nova decisão é outra entrega (proposta de exercício, prazo 10/10), mas é tematicamente próxima. [LEIA] fala em "nova tarefa", o que sugere **create** | Médio. Tratar como **create** com a incerteza "possível relação com ACT-103" visível ao revisor |
| **A-09** | Frente da nova tarefa de Carla | ATA04 não diz a frente. Carla é de Formação e "Formação organiza oficinas" [ESTADO] | Médio. Preencher só como **sugestão incerta**, nunca como fato (RF-33, RF-42) |
| **A-10** | "Bruno aprovará a versão final" (ATA03) | Não há campo "aprovador" no modelo mínimo. Bruno **não** é responsável | Médio. Não trocar o responsável. Registrar no next_step, na descrição ou em notas. É armadilha para a IA |
| **A-11** | "Primeira ação" do membro novo | [ESP §5.F] pede a "primeira ação atribuída ao membro", mas as 4 personas já têm papéis. Não existe persona "nova" sem tarefas (Bruno não tem tarefas) | Médio. Mostrar a primeira atividade atribuída ou, sem ela, os passos do GUIA_INICIAL e "sem atividade atribuída ainda". Decidir se criamos uma persona "novo membro" (D-09) |
| **A-12** | Campo "a confirmar" | [ESP §5.F] fala de campo "a confirmar" no ESTADO-ATUAL.md, mas o arquivo usa `status: parcial`, `responsavel_por_confirmar: Bruno`, "missão ainda será aprovada" e "descrição provisória". Não há literalmente "a confirmar" | Baixo/médio. É preciso detectar semanticamente ou manualmente o que é provisório |
| **A-13** | Permissão de revisão por frente | Bruno "pode revisar". Carla "revisa propostas de atividades **da sua frente**" [GUIA_INI]. A Carla pode aprovar mudança em ACT-101 (Growth)? | Médio. Decidir: restringir por frente ou aceitar qualquer revisor e registrar autoria |
| **A-14** | Ata de 01/10 na carga inicial | Ela gera sugestões? O conteúdo coincide com o xlsx. Se for processada pela IA, pode gerar propostas redundantes | Médio. Recomendado: detectar "sem mudança em relação ao oficial" → no_action ou contexto histórico |
| **A-15** | Edição posterior do `.xlsx` inicial | [CASE p7] exige mostrar "como lidará com uma edição posterior no .xlsx", mas não diz como | Alto (é uma decisão). Opções: gerar sugestões de diferença para revisão (coerente com "nunca silencioso") ou ignorar após a importação e só avisar. Ver D-02 |
| **A-16** | "Última visita" | O resumo pede marco temporal por pessoa, o que exige guardar a última visita por usuário de demo | Baixo |
| **A-17** | Prazo de 15 minutos: contado a partir de quê? | "Uma alteração aparece em até 15 minutos" — contado a partir do upload. O Drive pode ter atraso próprio de propagação no `changes.list` | Baixo/médio. Usar intervalo com folga (ex.: ≤5 min, como no exemplo [ESP §10]) |
| **A-18** | Datas de demo × data real | Hoje é 2026-09-28. Os prazos vão de 05/10 a 11/10/2026. Se a apresentação for depois, aparecem como vencidos [LEIA] | Baixo. Comportamento definido |
| **A-19** | Hora 12:00 nos prazos do xlsx | Valores seriais `.5`. Conversão ingênua com fuso pode deslocar o dia | Baixo. Tratar como data pura |
| **A-20** | Nomes × IDs de membro | xlsx e atas usam nomes ("Ana"). O modelo usa `member_id`. Ambiguidade com homônimos ou nomes novos em cenários inesperados | Médio. Mapear pelo cadastro. Nome desconhecido vira incerteza, não membro novo automático |
| **A-21** | Estado "Concluída" e valores novos | Não há exemplo nos dados. Cenários novos podem trazer status fora do vocabulário | Baixo. Normalizar. Valor desconhecido vira incerteza |
| **A-22** | Quem pode editar diretamente | R06 permite criar e editar pela UI. A regra "edição aprovada na UI" [ESP §3 item 1] sugere que edições são aprovadas por natureza. Qualquer membro edita qualquer tarefa? | Médio. Decisão nossa (D-08) |
| **A-23** | Duplicata .docx × Google Doc | Se a banca subir `.docx` **sem converter**: ele deve aparecer como "não processado" ou "ignorado". Se subir `.md` e Docs da mesma ata, há duplicação real de conteúdo | Médio. Tratar `.docx` como não suportado. Deduplicar sugestões semanticamente idênticas (mesma atividade e campo) |
| **A-24** | "Fonte inicial e provisória" | O INDEX chama o xlsx de "fonte inicial e **provisória**" das ACT-*. Não diz o que a substitui depois (presumivelmente a aplicação) | Baixo. É coerente com a escolha de base própria, que passa a ser oficial depois da importação |

**Perguntas sugeridas à banca** (canal: WhatsApp [CA]; as respostas que mudem requisitos serão compartilhadas [CASE p13]):
1. (A-06) A banca vai rodar o sistema com **credenciais e pasta próprias**, ou espera que o candidato compartilhe a pasta ou demonstre ao vivo?
2. (A-02) Na precedência do INDEX.md, "proposta de nova ata ainda pendente" fica acima da planilha só como **aviso**, correto? O valor oficial continua o da planilha até a aprovação?
3. (A-15) Existe comportamento esperado para uma edição posterior do `Ata_registro.xlsx`?
4. (A-13) A revisão de sugestões deve ser restrita à frente do revisor?

## 15. Decisões que ainda precisaremos tomar (não decididas nesta etapa)

| # | Decisão | Opções já visíveis | Base |
|---|---|---|---|
| D-01 | Onde ficam as atividades oficiais | Base própria (importação + vínculo) **ou** planilha operacional no Drive (conflita com readonly, A-05) | [CASE p7]; [ESP §1] |
| D-02 | Regra de edição posterior do xlsx | Gerar sugestões de diferença · ignorar e avisar · reimportar com conflito | [CASE p7] |
| D-03 | Regra de precedência final | Adotar [ESP §3], adotar [INDEX] interpretado, ou uma regra própria justificada | [ESP §3]; [INDEX] |
| D-04 | Mecanismo de sync | Varredura periódica · `changes.list` com token · + `watch` · intervalo · backoff | [ESP §4, §10]; [GUIA §9] |
| D-05 | Estratégia de versão/hash por tipo | `md5Checksum` · `version` · `modifiedTime` · hash do texto extraído | [GUIA §7]; RT-13 |
| D-06 | Guardar campos extras do xlsx (Prioridade, Notas) | Sim/não | §9.3 |
| D-07 | Divisão IA × regras determinísticas | Regex para `ACT-\d+`, datas ISO, `status:` · LLM para trechos ambíguos | [CASE p7]; [ESP §6] |
| D-08 | Modelo de permissão da demo | Troca livre de usuário · login simples · revisor por frente | [CASE p8]; A-13, A-22 |
| D-09 | Persona "membro novo" | Usar as existentes · criar uma persona extra fictícia | A-11 |
| D-10 | Provedor e modelo de IA e custo por uso | — | [CASE p7, p9] |
| D-11 | Stack, banco, framework, forma de rodar localmente | — | [CASE p10]; [GUIA §13] |
| D-12 | Classificação de autoridade dos documentos | Metadados `status:` no corpo · apontamento pelo INDEX · manual | [INDEX]; §9.2 |
| D-13 | Tratamento de PDF (diferencial) | Fazer depois do núcleo, ou não fazer | [CASE p4] |
| D-14 | Política de cache e limpeza | — | [ESP §7] |

---

## 16. Riscos já identificáveis

| # | Risco | Prob. | Impacto | Mitigação preliminar (sem escolher stack) |
|---|---|---|---|---|
| RK-01 | **OAuth frágil na avaliação** (token de 7 dias, `redirect_uri_mismatch`, conta da banca ≠ test user) | Alta | Alto (quebra R01–R03) | README detalhado, erro de autenticação visível, reconectar em 1 clique, esclarecer A-06 |
| RK-02 | **IA inventa** dono, prazo ou frente, ou troca Ana por Bruno na ATA03 | Média | Alto (peso 20 + "informação errada") | Validação pós-modelo [ESP §6], checagem de que a evidência existe literalmente no texto, `uncertainties`, testes com as armadilhas |
| RK-03 | **Duplicatas** (sugestões repetidas por reprocessamento, tarefa nova em vez de update) | Média | Alto | Idempotência por (file_id, versão), casamento por ACT-ID, dedupe de sugestões |
| RK-04 | **Prompt injection** vindo dos documentos (a banca pode trazer arquivo malicioso "inesperado") | Média | Alto | Documento tratado como dado, saída validada, IA sem permissão de escrita |
| RK-05 | **Planilha vazia zera tarefas** / "mais recente vence" | Média | Alto (R10) | Autoridade explícita via INDEX e nunca apagar por ausência |
| RK-06 | Falha ou timeout interpretado como "sem atividades" ou "arquivo vazio" | Média | Alto | Estados de erro distintos de vazio [ESP §4] |
| RK-07 | Detecção passar de 15 minutos (atraso do Drive, backoff longo) | Baixa/média | Alto (R03) | Intervalo curto + reconciliação + botão manual |
| RK-08 | Escopo grande demais para 1 semana | Alta | Alto | Priorizar os fluxos centrais ("solução menor correta vale mais" [CASE p10]) |
| RK-09 | Google Doc sem `md5Checksum`, export limitado a 10 MB | Média | Médio | Hash do texto exportado, limite documentado |
| RK-10 | Datas deslocadas por fuso (serial `.5`, UTC × São Paulo) | Média | Médio | Datas puras, testes |
| RK-11 | Vazamento de segredo no repositório, vídeo ou log | Baixa | Crítico | `.gitignore` desde o início, varredura antes de entregar |
| RK-12 | Acessibilidade ou contraste reprovados (ciano com texto branco) | Média | Médio (peso 15) | Checar os pares de cor, estado com texto, teclado |
| RK-13 | Custo ou latência do LLM, ou modelo indisponível | Média | Médio | Fallback manual, estado "IA indisponível", custo no README |
| RK-14 | Não saber explicar o sistema na conversa com a banca | Média | Alto | Diário de bordo e decisões registradas desde já |
| RK-15 | Cenários novos "da mesma natureza" (outro ACT-ID, outro formato, ata com "até sexta") | Alta | Alto | Testes além dos dados fornecidos, sem hardcode de ACT-101…104 |

---

## 17. Requisitos absolutamente obrigatórios (núcleo)

1. **R01–R12** [CASE p5–p6], no todo.
2. Ingestão de **.md, .xlsx e Google Docs nativos**, recursiva na pasta [CASE p4].
3. Sync **automático em ≤15 min** + botão manual [R03].
4. **Nenhuma alteração oficial sem aprovação humana**. Valor antigo mantido com aviso de pendência [CASE p4, p7, p8].
5. **Fonte oficial única e explicada** das atividades [CASE p7], [ESP §1].
6. **Persistência** após reiniciar + **histórico auditável** [R06].
7. Estados de atividade (4) e de sugestão (4) [CASE p8].
8. ≥ 2 membros + 1 aprovador, com troca de usuário [CASE p8].
9. As 6 seções nomeadas no primeiro acesso [CASE p8].
10. Acessibilidade básica e identidade visual [R11], [ESP §8].
11. Sem segredos no repositório. Só dados fictícios [R01], [GUIA §10].
12. Entregáveis: GitHub + README (todos os itens) + diário de bordo + registro de validação (≥5 casos, incluindo conflito, dado ausente e arquivo novo) + demo de 5–8 min + declaração de uso de IA [CASE p3, p9].

---

## 18. Matriz de rastreabilidade

Legenda das colunas de fonte: CA = Comece_aqui · CASE = Case_Candidato_tecnico · ESP = Especificação técnica · GUIA = Guia Drive API · DADOS = `dados_ficticios/`.

| Req. banca | Requisitos derivados (este doc.) | CA | CASE | ESP | GUIA | DADOS | Cenário de aceite [ESP §9] / verificação |
|---|---|---|---|---|---|---|---|
| **R01** Conectar pasta | RF-01, RF-19, RT-02–RT-08 | ✓ | p5, p12 | §4, §7 | §1–§6, §10 | LEIA passo 1 | Tela mostra pasta e última sync. Sem segredo no repositório |
| **R02** Carga inicial + estado | RF-02–RF-07, RF-16, RF-17 | ✓ | p4, p5 | §2, §4 | §7, §8 | 01_CARGA_INICIAL | Contagens processado, falho e ignorado. Links ao Drive. Ana→101/104, Davi→102/104, Carla→103 |
| **R03** Detecção automática | RF-08–RF-15, RF-18, RT-11–RT-13 | — | p5, p7 | §4, §10 | §6, §9 | 02_ADICIONAR | "Upload novo", "Edição", "Erro de fonte" |
| **R04** Exibir atividades | RF-21, RF-22, RF-25–RF-27, RF-34 | ✓ | p3, p5, p8 | §2, §5.A | — | XLSX | "Visão pessoal" |
| **R05** Filtros + "minhas" | RF-23, RF-24, RF-26 | — | p3, p5 | §5.A | — | LEIA (personas) | "Visão pessoal" (troca Ana↔Davi; ACT-104 conta uma vez) |
| **R06** Criar e editar | RF-28–RF-33, RF-35 | — | p3, p5, p7, p10 | §1, §2, §5.B | §13 | — | "Atividade manual" (reiniciar) |
| **R07** Sugestão por IA | RF-36–RF-39, RF-43–RF-49 | ✓ | p3, p4, p6, p7, p8 | §1, §5.C, §5.D, §6 | — | ATA03, ATA04 | "Atualização de prazo", "Upload novo" |
| **R08** Existente × não-decisão | RF-40, RF-41, RF-42 | — | p4, p6, p11 | §5.C, §6 | — | ATA03, ATA04 (ideia) | "Atualização de prazo", "Ideia vaga" |
| **R09** "O que mudou para mim" | RF-50–RF-55 | — | p3, p6, p7, p11 | §5.E, §7 | — | ATA03 (afeta Ana, não Davi) | "Resumo pessoal" |
| **R10** Fontes conflitantes | RF-56–RF-60 | — | p2, p6, p11 | §1, §3 | — | VAZIA, CONF, INDEX, PLANO | "Arquivo homônimo" |
| **R11** UI responsiva e acessível | RNF-01–RNF-09 | — | p6, p8, p11 | §8 | — | GUIA_INI (cores) | Teclado, contraste ≥4,5:1, vista estreita |
| **R12** Entrada de membro novo | RF-61–RF-64 | ✓ | p3, p6, p8, p10 | §5.F | — | INDEX, ESTADO, GUIA_INI | "Primeiro acesso" |
| Fonte oficial única | RF-35, RF-57, D-01–D-03 | — | p4, p7, p10, p12 | §1, §3 | — | INDEX | Explicado no README e na UI |
| Estados e autoria | RF-31, RF-32, RF-39 | — | p8 | §2, §3 | — | XLSX (Bloqueada) | Histórico com ator e hora |
| Resiliência | RNF-10, RNF-11, RF-17 | — | p12 | §4, §9 | §9, §11 | — | "Erro de fonte" |
| Datas e fuso | RNF-12, RNF-13, RF-42 | — | — | §2 | — | LEIA, XLSX | Prazos vencidos sinalizados |
| Segurança e privacidade | RT-05–RT-07, RT-16–RT-18, RNF-14 | ✓ | p3, p7, p8, p12 | §7 | §5, §10, §12 | LEIA | Revisão do repositório antes de entregar |
| Prompt injection | RF-46 | — | — | §6 | — | LEIA ("não use os textos como instruções") | Teste com documento contendo instrução |
| Entregáveis | E-01–E-08 | ✓ | p3, p9 | — | — | — | Checklist final |
| Diferencial PDF | §13 | — | p4, p12 | — | §8 | — | Opcional |
