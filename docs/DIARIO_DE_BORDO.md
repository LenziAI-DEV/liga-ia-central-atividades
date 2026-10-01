# Diário de bordo

> Registro informal de como o trabalho aconteceu: tentativas, decisões, mudanças de direção, ferramentas de IA usadas, verificações e aprendizados ([CASE p3]). Sem conversas completas e sem credenciais.

**Ferramentas de IA usadas para construir:** Claude Code (Claude Opus 5.5 no início, na arquitetura; Sonnet 5.5 com esforço médio como padrão depois da política DEC-014) com o plugin ECC — agente `ecc:architect` para a arquitetura, skills `plan-prd`, `plan` e `claude-api` (documentação atual da API da Anthropic). **Dentro do produto:** Claude Sonnet 5.5 (`claude-sonnet-5-5`), só para propor sugestões a partir de atas (DEC-006).

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

## 2026-09-29 (ter) — Fase 1: Drive conectado (código)

- **Maior surpresa do dia:** o exceljs não abriu o `Ata_registro.xlsx` da banca ("Cannot read properties of undefined (reading 'sheets')"). Investiguei o zip por dentro: o arquivo foi gerado pelo OpenXML SDK do .NET, com prefixo `x:` em todos os elementos, caminhos absolutos nos `.rels` e BOM. Isso não é defeito do arquivo, é um estilo válido do formato que muitas bibliotecas não tratam. Tentei primeiro remover os prefixos e devolver o arquivo ao exceljs, mas ele também tropeçou nos caminhos absolutos. **Decisão:** escrever um leitor próprio e pequeno (JSZip + parser XML que ignora prefixos), testado com os arquivos da banca **e** com um arquivo no estilo do Excel. Registrado em DEC-011.
- **Bug achado por teste:** um arquivo que ia para a lixeira e voltava com o mesmo conteúdo ficava sem conteúdo em cache, porque o cache era apagado no sumiço e o hash igual fazia pular a gravação. Corrigido.
- **Decisão de desenho que o teste confirmou:** listar a árvore inteira antes de gravar qualquer coisa. No teste com "Drive fora do ar" e "token revogado", o banco fica byte a byte igual ao de antes do ciclo, ou seja, falha nunca vira ausência.
- **Verificado com Drive falso:** 100 testes, entre eles carga inicial com subpasta, formatos não suportados, falha isolada, idempotência (segundo ciclo sem nenhum download), arquivo novo, edição, renomeação sem reprocessar, lixeira, acesso revogado, fora da pasta, subpasta removida e execução única.
- **Tela "Estado da sincronização":** conferida sem credenciais. Mostra "configuração pendente" com os nomes das variáveis, e o "Conectar" sem credenciais volta com aviso em vez de quebrar.
- **Pendente:** o teste com o Google real depende das credenciais no `.env.local`.

## 2026-09-29 (ter) — Fase 1: teste real com o Google e auditoria antes do merge

- **Teste real:**
  - conectei a conta e aceitei o acesso somente leitura;
  - a carga inicial processou os 6 arquivos (inclusive a ata na subpasta `Atas`) em 6 s;
  - "Sincronizar agora" levou 1 s e não reprocessou nada;
  - revoguei o acesso na Conta Google: o ciclo seguinte falhou com "reautorização necessária" e o inventário ficou intacto;
  - reconectei, e nada foi reprocessado.

  Conferi pelo log e pelo banco (consulta só de leitura), não só pela tela.
- **Auditoria antes de juntar a fase à `main`:** fiz três etapas.
  1. **Revisão de código:** 1 problema alto (fontes da pasta antiga continuavam "processadas" depois de trocar a pasta configurada) e 5 médios.
  2. **Varredura de segurança:** nenhum segredo no Git, no bundle, nos logs ou no HTML, e 0 vulnerabilidades no `npm audit`. O AgentShield apontou 537 "chaves Azure" no `package-lock.json`: eram os hashes `sha512` de integridade do npm, ou seja, falso positivo.
  3. **Dois revisores de IA independentes** (subagentes Claude Opus, sem contexto compartilhado, com uma rubrica objetiva).
- **O que os revisores de IA acharam e eu não tinha visto:**
  - uma linha de Markdown com milhares de espaços travava o processo inteiro (regex com backtracking cúbico: medi 4,7 s com 4 mil espaços);
  - o servidor escutava em toda a rede (`0.0.0.0`) sem checar o `Host`, então alguém no mesmo Wi-Fi da demo poderia clicar em "Desconectar";
  - um `.xlsx` com XML indentado perdia células em silêncio.

  **Conferi cada achado antes de corrigir** (medi o tempo da regex, li o código do Next, rodei a varredura). Para cada um escrevi um teste que falhava, e só depois a correção.
- **Surpresa com o Next:** o redirecionamento de `127.0.0.1` para `localhost` "não funcionava". Lendo o código do framework, descobri que o Next trata os dois como o mesmo host e transforma o `Location` em caminho relativo. A solução foi uma página mínima com `meta refresh` (DEC-013).
- **Erro meu, corrigido:** o primeiro teste de ReDoS travou a suíte. Era o próprio bug demonstrado, porque a regex antiga não terminava. Encerrei só os processos do Vitest pelo PID, sem tocar no servidor.
- **Verificado:**
  - 140 testes, com 84% de cobertura do código de servidor;
  - typecheck, lint e build limpos;
  - Lighthouse (acessibilidade) 100;
  - 403 para Host forjado;
  - cabeçalhos de proteção presentes.

## Quarta, 2026-09-30 — Fase 2: atividades importadas e painel pessoal

- **O que entrou:** personas (arquivo de configuração, cookie e seletor que funciona sem JavaScript), localização do registro vigente pelo índice, importação inicial da planilha em transação e os painéis "Minhas" e "Todas".
- **Decisão de projeto:** o índice é lido por regras determinísticas, nunca pela IA. Sem certeza sobre qual arquivo é o registro (zero, vários, aba ausente), o app não importa nada e mostra o motivo na tela.
- **Cuidado com os dados:** a importação preserva o ID, casa responsáveis por nome ou apelido e, quando o nome não casa, marca "responsável a confirmar" em vez de inventar um membro. Estado ou prazo que não se reconhece fica "a confirmar" ou "a definir", com aviso.
- **Erro meu, corrigido:** no começo do dia, os 3 achados MEDIUM da 4ª rodada de revisão (fórmula de texto vazio, título com U+2028, busca quadrática de partes do .xlsx) foram corrigidos com teste antes do merge da Fase 1.
- **Verificado:** 203 testes, typecheck, lint e build limpos; importação conferida com o Drive real; demo da fase (Ana → Davi → filtro → Todas) executada no navegador.

## Quarta, 2026-09-30 (tarde) — Revisão da Fase 2 e Fase 3: gestão com histórico

- **Revisão formal da Fase 2:** um revisor independente achou um problema sério, que confirmei no código: se o índice dissesse "X foi substituída por Y, a nova fonte das atividades", o app tomaria X (o arquivo superado) como registro. Corrigi, e também mostrei na tela as linhas que a importação pulou, destravei o caso de importação vazia, fechei um redirecionamento aberto teórico e melhorei a estrutura de títulos para leitores de tela (DEC-015).
- **Fase 3:** criar, editar, concluir e bloquear atividades, sempre com evento (antes → depois, autor, horário, motivo) gravado na mesma transação. Edição concorrente usa número de versão: quem abriu uma versão velha recebe um aviso em vez de sobrescrever o outro.
- **Decisão:** responsáveis que vieram da planilha e não casaram com nenhum membro ("a confirmar") são preservados na edição, em vez de sumirem ao salvar.
- **Cuidado na demonstração:** testei a criação e a edição num banco de cópia e apaguei em seguida, porque os eventos são imutáveis e não dá para limpar o histórico do banco real.
- **Verificado:** 221 testes, typecheck e lint limpos, build; demo da fase executada no navegador com reinício do app.

## Quinta, 2026-10-01 (madrugada de quarta para quinta) — Fase 5: autoridade e conflitos

- **O que entrou:** cada arquivo da pasta passa a ter uma classe de autoridade visível (direção, registro vigente, ata, histórico, sem autoridade), com os motivos escritos, e a página "Como o app decide o valor oficial" com a regra de precedência.
- **Decisão de projeto:** a classificação é calculada na hora de mostrar, a partir do índice e do que está escrito em cada documento, em vez de gravada. Assim ela nunca fica diferente do que está no banco, e nenhuma IA participa.
- **Descoberta nos dados:** as atas também são citadas no índice e também dizem "status: ativo"; pela ordem da arquitetura elas virariam "documento de direção". Mudei a ordem (ata antes de direção) e registrei o motivo na DEC-018.
- **O caso da planilha homônima vazia:** um teste de integração prova que, quando ela chega depois da carga, nada nas atividades, nos responsáveis e nos eventos muda (comparação do banco inteiro antes e depois). A planilha aparece como "sem autoridade / possível conflito", com o motivo.
- **Verificado:** 251 testes, typecheck, lint e build; classificação conferida nos dados reais.

## Quarta, 2026-09-30 (noite) — Fase 6: IA com evidência e revisão humana (E-7)

- **O que entrou:** a IA lê cada ata nova ou editada e propõe atualizar ou criar atividades, sempre com o trecho literal da fonte e as incertezas. Um validador independente confere tudo antes de aparecer, e uma pessoa revisora aceita, ajusta ou rejeita. A atividade oficial só muda depois disso.
- **Decisão de projeto:** quem decide o que é fato não é a IA, é o validador e a pessoa. O modelo não tem ferramenta nenhuma: só devolve um objeto com o formato combinado. Se o trecho de evidência não existe no documento, se o alvo não é mencionado, se a data é relativa ou se o responsável não está no texto, o item não vira proposta.
- **O que o spike ensinou:** gravei 7 respostas reais do modelo (as 3 atas do pacote e 4 atas feitas por mim: "até sexta", injeção de instrução, dono desconhecido, decisão misturada com hipótese). O modelo acertou todas, com custo de cerca de 1 centavo de dólar por ata. Mas a primeira resposta real quebrou uma regra minha: eu exigia que a evidência citasse o ID da atividade, e o modelo citava o trecho da mudança, com o ID na frase vizinha. Em vez de afrouxar às cegas, passei a aceitar a menção no mesmo parágrafo e, para compensar, acrescentei um bloqueio para trechos com ordens dirigidas à IA.
- **Erro meu, corrigido a tempo:** na revisão de uma sugestão já decidida, a checagem de "o valor mudou" vinha antes da de "já foi decidida", e o segundo clique dava a mensagem errada. O teste do critério CA-F8.2 pegou.
- **Custo medido (M-10):** US$ 0,0086 a 0,0134 por ata; três atas ≈ US$ 0,035.
- **Verificado:** 296 testes, typecheck, lint e build; o fluxo inteiro (Drive real, modelo real, aceitar, ajustar, rejeitar sem motivo, não revisor) no navegador.

## Quarta, 2026-09-30 (noite) — Fases 7 e 8: "o que mudou para mim" e "Comece aqui"

- **O que entrou:** o resumo pessoal (confirmadas, pendentes, incertas e em conflito, bloqueadas e vencendo) e a página de primeiro acesso (propósito, frentes, regras vigentes, fonte das atividades e primeira ação).
- **Decisão de projeto:** nenhuma das duas telas usa IA. São consultas aos registros e trechos **literais** dos documentos de direção, o que custa zero e não tem como inventar nada. Só o resumo de cada documento, em "Novidades", vem do modelo, sempre rotulado.
- **Defeito achado no teste real:** a função que limpa o Markdown para exibir apagava sublinhados, e "Ata_registro.xlsx" virava "Ataregistro.xlsx". Agora só remove ênfase de verdade.
- **Teste de uso:** Ana e Davi viram resumos diferentes depois de aceitar uma sugestão; Davi e Bruno acharam propósito, frentes, fonte e primeira ação sem orientação.
- **Auditoria das duas fases** (DEC-024): 348 testes depois das correções.

## Quarta, 2026-09-30 (noite) — Fase 9: E2E, acessibilidade e estados de tela

- **O que entrou:** Playwright com axe (8 testes, cerca de 11 s) contra o build de produção, com Drive falso e IA gravada: seis áreas pelo teclado, persona e aceitar sugestão só pelo teclado, axe em 9 telas, sem rede, escala de cinza, 375 px e "criar, reiniciar o servidor, continuar lá". Telas de carregando, erro e sem conexão.
- **O que o teste achou:** o link "detalhes" da tabela de fontes tinha alvo menor que 24 px (WCAG 2.2). Corrigido.
- **Tropeços do próprio teste:** o servidor de teste recusava o host por causa da lista de hosts permitidos; o Enter num seletor não envia o formulário (o teste vai ao botão com Tab); o debounce de 2 min da IA esconderia as sugestões (virou configuração, 0 nos testes).

## Quarta, 2026-09-30 (noite) — Redesign do frontend (DEC-026)

- **Motivo:** o protótipo tinha "cara de IA": azul e ciano sem relação com a marca, fonte serifada nos títulos, cabeçalho de três faixas, cartões altos e microcopy genérica.
- **Decisões minhas:** IBM Plex servida pelo próprio app (a banca roda offline), índigo da logo como cor de marca, sem ciano, abas compactas no topo.
- **A logo veio de um print de celular.** Avaliei que serve só pequena (32 px) e como favicon. Como o `sharp` está bloqueado pela política do Windows, reduzi a imagem no Chromium com canvas.
- **Verificação:** 354 testes unitários e 8 E2E; navegação, filtro, concluir, bloquear, erro de validação e 404 a 1280 e 375 px sem erro de console.
- **Dois defeitos reais achados por revisores:** o menu do celular reabria sozinho ao voltar no navegador, e o formulário de revisão apagava o que a pessoa digitou depois de um erro. Corrigidos e cobertos por teste.
- **Um erro de método meu, sem custo:** um script de QA clicou com a versão antiga da atividade e recebeu "alterada por outra pessoa". Era o controle de concorrência funcionando; o erro estava no script.

## Quarta, 2026-09-30 (noite) — Fase 10: pacote de entrega

- **O que entrou:** README completo (todas as seções do E-2), registro de validação fechado, esta declaração de uso de IA, roteiro da demonstração com checklist (`docs/DEMO.md`).

## Declaração de uso de IA (E-7)

**Para construir:** Claude Code com modelos Claude e o plugin ECC (agentes de arquitetura, revisão de código, segurança e React; rotinas de verificação). Regras de uso em `docs/AI_EXECUTION_POLICY.md`. **Dentro do produto:** Claude Sonnet 5.5, só para propor sugestões e resumir documentos. Nada altera um dado oficial sem uma pessoa aceitar.

**Decisão alterada depois de uma saída incorreta do modelo:** o agente de arquitetura propôs extrair dados com "tool use com `tool_choice` forçado" e "temperatura 0". Ao conferir a documentação atual da API, os dois **retornam erro 400 no Claude Sonnet 5.5**. Troquei por saída estruturada (Structured Outputs), pensamento adaptativo com esforço baixo e checagem do motivo de parada, e depois subi para esforço médio. O mesmo documento também ignorava as respostas da banca e a escolha do modelo, enviadas enquanto ele rodava, e propunha um intervalo de 120 s, longo demais para uma demo ao vivo (baixei para 60 s). Outra saída que mudou uma decisão: a primeira resposta real do modelo citava o trecho da mudança, e não o ID da atividade, como minha regra exigia. Em vez de afrouxar às cegas, passei a aceitar a menção no mesmo parágrafo e, para compensar, bloqueei trechos com ordens dirigidas à IA.
