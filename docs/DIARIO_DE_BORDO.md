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
