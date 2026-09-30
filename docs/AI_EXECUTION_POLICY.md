# Política permanente de execução, modelos, tokens e agentes

> **Documento canônico.** Adotado em 2026-09-30 por instrução do usuário (DEC-014). Vale para todas as sessões e tarefas relevantes deste projeto. **Não pode ser removido ou ignorado sem autorização explícita do usuário.**
> `CLAUDE.md` só aponta para este arquivo. A política completa está aqui.

O projeto adota uma política **permanente** de otimização de uso do Claude Code + ECC. O objetivo é manter a maior qualidade possível **sem desperdiçar** tokens, contexto, subagentes ou modelos mais caros em tarefas que não precisam deles.

**Problema conhecido deste projeto:** nas sessões anteriores, o uso frequente de Opus com effort alto e de múltiplos agentes de revisão consumiu o limite em excesso. Por isso, a IA deve ser especialmente conservadora ao:

- escolher Opus;
- escolher High/Extra High;
- criar múltiplos revisores;
- usar santa-loop;
- revisar o repositório inteiro;
- criar subagentes paralelos.

Se uma combinação mais barata provavelmente for suficiente, a IA a recomenda antes de trabalhar. A IA também atua como **guardiã do orçamento de tokens** do projeto.

---

## 1. Persistência

- Fonte de verdade completa: `docs/AI_EXECUTION_POLICY.md` (este arquivo).
- O `CLAUDE.md` tem uma seção curta e obrigatória que aponta para cá. Ela diz que:
  - este documento deve ser lido antes de tarefas relevantes;
  - as regras de modelo, effort, subagentes, contexto e revisão são obrigatórias;
  - nenhuma tarefa complexa começa sem avaliação de custo e complexidade.

## 2. Regra mais importante: model routing antes de trabalhar

Antes de qualquer tarefa não trivial, avaliar:

- complexidade;
- risco;
- tamanho esperado da mudança;
- quantidade de arquivos envolvidos;
- necessidade de raciocínio profundo;
- necessidade de subagentes;
- impacto arquitetural;
- impacto em segurança;
- custo e contexto esperados.

Quando apropriado, usar os recursos do ECC, em especial `/ecc:model-route`. O objetivo é usar o **modelo mais barato** que execute a tarefa com qualidade suficiente.

Antes de iniciar, informar de forma curta:

```text
MODEL ROUTING
Modelo recomendado: <modelo>
Effort recomendado: <nível>
Motivo: <1 ou 2 frases>
Subagentes: <nenhum / quantidade aproximada / justificativa>
```

Exemplo:

```text
MODEL ROUTING
Modelo recomendado: Sonnet
Effort recomendado: Medium
Motivo: implementação normal bem especificada, sem decisão arquitetural crítica.
Subagentes: nenhum inicialmente.
```

- **Modelo/effort atual adequado:** informar a recomendação e continuar.
- **Modelo/effort atual excessivo:** avisar antes de trabalhar. Exemplo: "Estamos em Opus High, mas esta tarefa só exige Sonnet Medium. Recomendo reduzir antes de continuar para economizar tokens." Se a diferença de custo for significativa, parar e esperar a decisão do usuário.
- **Modelo/effort atual insuficiente:** avisar antes de trabalhar. Exemplo: "Esta tarefa envolve uma decisão arquitetural crítica e múltiplos trade-offs. Recomendo Opus High antes de continuar." Parar antes da execução pesada e esperar a troca.

## 3. Política padrão de modelos

### Haiku / modelo leve

Para tarefas principalmente mecânicas e de baixo risco:

- localizar arquivos;
- procurar símbolos;
- leitura simples;
- extração de informações;
- pequenas transformações;
- tarefas repetitivas;
- verificações simples;
- coleta de contexto;
- exploração inicial extremamente objetiva.

Não usar para decisões importantes do projeto.

### Sonnet: modelo padrão deste projeto

Para:

- implementação normal e desenvolvimento de features;
- correção de bugs comuns e refatorações;
- criação de testes;
- frontend e backend;
- APIs, banco de dados e integração de serviços;
- documentação;
- code review normal e browser QA;
- análise de erros e debugging de complexidade normal;
- execução de planos já aprovados.

Na dúvida entre Sonnet e Opus, começar com Sonnet.

### Opus: uso seletivo

Principalmente para:

- arquitetura complexa;
- decisões com grandes trade-offs;
- requisitos muito ambíguos;
- bugs extremamente difíceis e root cause analysis difícil;
- segurança crítica;
- revisão extremamente profunda;
- problemas em que o Sonnet já tentou e falhou;
- decisões irreversíveis ou de alto impacto;
- análise estratégica de grandes partes do sistema.

Opus **não** é o modelo padrão. Nunca escolher Opus só porque ele é mais poderoso.

## 4. Escalada de modelo

Sempre que possível: **Haiku → Sonnet → Opus**. Começar pelo menor modelo suficientemente capaz e só escalar com justificativa concreta, como:

- tentativa anterior falhou;
- raciocínio complexo demais;
- conflito arquitetural;
- ambiguidade relevante;
- alta criticidade;
- vulnerabilidade de segurança complexa;
- debugging profundo sem causa aparente.

Não escalar só por precaução.

## 5. Política de effort

Effort também é recurso caro.

- **Low:**
  - buscas e leitura;
  - alterações mecânicas e pequenas mudanças;
  - tarefas óbvias e organização;
  - documentação simples e operações rotineiras.
- **Medium (padrão deste projeto):**
  - implementação normal, testes e refatoração;
  - code review normal e análise de código;
  - debugging comum;
  - documentação técnica e integração;
  - browser QA.
- **High:** quando há necessidade real de raciocínio adicional:
  - planejamento complexo;
  - debugging difícil;
  - decisões arquiteturais;
  - security review relevante;
  - refatorações complexas;
  - análise de múltiplos componentes;
  - problemas com muitos edge cases.
- **Extra High (ou equivalente):** nunca como padrão. Só em casos excepcionais:
  - problema crítico que resistiu a tentativas anteriores;
  - arquitetura extremamente complexa;
  - investigação muito difícil;
  - situações em que High comprovadamente não bastou.

## 6. Configuração padrão recomendada

| Situação | Modelo | Effort |
|---|---|---|
| Maior parte do desenvolvimento | Sonnet | Medium |
| Tarefa difícil | Sonnet | High |
| Arquitetura ou problema excepcionalmente complexo | Opus | High |

Extra High é excepcional.

## 7. Política de subagentes

Subagentes **não** são criados só porque estão disponíveis. Usar apenas quando:

- há trabalhos realmente independentes que podem correr em paralelo;
- é necessário isolar contexto;
- a especialização traz benefício claro;
- uma segunda opinião independente tem valor real;
- o workflow do ECC justifica explicitamente.

**Não** criar subagentes para:

- leitura simples ou localizar arquivos;
- pequenas mudanças ou alterações triviais;
- tarefas sequenciais;
- executar comandos básicos;
- repetir análise já feita;
- revisar exatamente o mesmo escopo sem benefício claro.

Antes de criar vários subagentes, perguntar: *"Esse paralelismo realmente melhora qualidade ou apenas multiplica tokens?"* Se só multiplica tokens, não criar.

## 8. Modelos dos subagentes

Quando o harness permitir escolher o modelo do subagente, preferir modelos mais baratos para tarefas simples:

| Papel | Modelo |
|---|---|
| Agente principal | Sonnet Medium |
| Subagente de exploração | Haiku ou equivalente leve |
| Subagente de testes simples | Haiku/Sonnet, conforme a complexidade |
| Subagente de code review | Sonnet Medium |
| Subagente de security review normal | Sonnet Medium/High |
| Arquiteto crítico | Opus, só se necessário |

Não usar Opus em todos os subagentes por padrão.

## 9. Evitar fan-out desnecessário

Ter cuidado especialmente com Opus, que tende a explorar demais ou criar muitos subagentes:

- limitar delegações;
- preferir trabalho direto quando possível;
- não investigar caminhos irrelevantes;
- não abrir vários agentes para responder à mesma pergunta;
- não fazer revisão redundante sem justificativa.

## 10. Política de code review (proporcional ao risco)

Não executar todas as ferramentas de revisão em todas as mudanças.

| Mudança | Fluxo |
|---|---|
| Pequena | `verification-loop` ou testes diretamente aplicáveis |
| Feature normal | `/ecc:code-review` → `verification-loop` (→ `/ecc:browser-qa` se houver frontend) |
| Feature sensível (autenticação, autorização, dados pessoais, APIs externas, Google Drive, secrets, banco, uploads, permissões) | `/ecc:code-review` → `/ecc:security-scan` → `verification-loop` → `browser-qa` quando aplicável |
| Milestone importante | `/ecc:code-review` → `/ecc:security-scan` quando aplicável → `verification-loop` → `/ecc:quality-gate` |
| Milestone crítico ou pré-entrega | Os anteriores e, só nesse caso, considerar também `/ecc:santa-loop` |

**Não usar santa-loop rotineiramente:** é revisão adversarial adicional e pode consumir muitos tokens.

## 11. Evitar reviews redundantes

Não executar automaticamente, em toda alteração, `code-review` + `security-review` + `santa-loop` + `quality-gate` + outros revisores. Antes de cada revisão, avaliar: *"Existe um risco específico que justifique esta etapa?"* Se não existir, pular.

Qualidade não é executar todas as ferramentas disponíveis. Qualidade é executar as ferramentas **certas** para o risco existente.

## 12. Security review

Obrigatório quando a mudança envolver:

- autenticação, autorização ou permissões;
- secrets, credenciais ou tokens;
- APIs ou exposição pública de endpoints;
- dados sensíveis;
- uploads ou manipulação de arquivos;
- integrações externas (inclusive Google Drive);
- banco de dados;
- execução de código.

Para alterações puramente visuais ou documentação simples, não fazer security review completa sem motivo.

## 13. Browser QA

Usar `/ecc:browser-qa` quando houver algo realmente verificável no navegador:

- UI e navegação;
- formulários e fluxos;
- responsividade e acessibilidade;
- console e network;
- interação com o usuário.

Não usar em tarefas exclusivamente de backend sem interface afetada.

## 14. Context budget

Contexto é recurso limitado. Usar `/ecc:context-budget` quando necessário, especialmente se:

- a sessão estiver crescendo muito;
- vários agentes estiverem carregando contexto;
- o `CLAUDE.md` estiver grande;
- houver muitas rules;
- MCPs estiverem adicionando overhead;
- o projeto estiver consumindo tokens em excesso.

Sempre minimizar contexto irrelevante. Subagentes recebem só o contexto necessário para a missão deles. Não despejar o projeto inteiro em todos os agentes.

## 15. Compactação estratégica

Compactar nos **limites naturais** entre fases:

- pesquisa concluída → compact → implementação;
- milestone concluído → compact → próxima feature;
- debug resolvido → compact → próxima tarefa.

Não é preciso esperar o contexto quase cheio. Mas **não** compactar no meio de uma investigação complexa, quando detalhes recentes ainda são essenciais. Antes de compactar, garantir que as decisões importantes estejam persistidas na documentação.

## 16. Memória e documentação

A conversa não é a fonte de verdade permanente. Manter atualizados, quando aplicável:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/PROGRESS.md`
- `docs/AI_EXECUTION_POLICY.md`

Antes de depender de memória de sessão, verificar a documentação canônica. Ao fim de milestones relevantes, atualizar `PROGRESS.md` e as decisões.

## 17. Gestão de sessão do ECC

- Ao encerrar sessões relevantes, persistir o estado com `/ecc:save-session`.
- Ao retomar, quando necessário, usar `/ecc:resume-session`.
- Nunca depender só da memória da sessão: o que importa fica nos documentos do projeto.

## 18. Diagnóstico de custo

Usar `/ecc:cost-report` periodicamente para ver onde os tokens estão sendo consumidos. Se o consumo subir muito, verificar, nesta ordem:

1. modelo;
2. effort;
3. número de subagentes;
4. redundância de reviews;
5. tamanho de contexto;
6. skills e rules carregadas;
7. MCPs;
8. necessidade de compactação.

## 19. Auditoria do harness

Periodicamente, sobretudo depois de mudanças importantes no setup do ECC, usar `/ecc:harness-audit`. Analisar principalmente:

- Context Efficiency e Cost Efficiency;
- redundâncias;
- agentes, hooks e MCPs;
- configuração e rules.

## 20. Model routing do ECC

Quando houver dúvida relevante sobre o modelo, usar `/ecc:model-route`. A recomendação considera dificuldade, risco, custo, ambiguidade, necessidade de raciocínio e quantidade de contexto.

Não transformar isso em burocracia: para tarefas obviamente simples, avaliar rapidamente por conta própria.

## 21. Escalar somente quando necessário

- Se Sonnet Medium executa corretamente, **não** usar Opus High.
- Se Sonnet High resolve, **não** usar Opus.
- Se Opus Medium resolve, **não** usar Opus High.
- Se High resolve, **não** usar Extra High.

Aumentar recursos só com sinal concreto de que o nível atual não basta.

## 22. Custo marginal

Antes de adicionar outro agente, review, loop ou modelo, mais effort ou outra leitura completa, perguntar: *"Qual ganho específico de qualidade espero obter com este custo adicional?"* Se a resposta não for clara, não adicionar.

## 23. Mais computação não é mais qualidade

Mais tokens, agentes, reviews e modelos maiores **não** garantem uma resposta melhor. Evitar overthinking. O objetivo é **a máxima qualidade necessária com o mínimo custo razoável**.

## 24. Workflow padrão de feature

1. Analisar a tarefa.
2. Fazer o MODEL ROUTING.
3. Ler só o contexto necessário.
4. Planejar, se necessário.
5. Implementar.
6. Usar TDD quando aplicável.
7. Verificar.
8. Code review proporcional.
9. Browser QA, se aplicável.
10. Security review, se aplicável.
11. Atualizar os docs relevantes.
12. Encerrar.

Não adicionar etapas sem justificativa.

## 25. Workflow de tarefa pequena

MODEL ROUTING → implementação → teste ou verificação mínima → concluir. Não criar workflow pesado.

## 26. Workflow de arquitetura

Para decisão arquitetural relevante, fazer o MODEL ROUTING. Normalmente, começar com Sonnet High. Se a complexidade justificar, Opus High.

Depois: architect → análise de trade-offs → decisão documentada em `DECISIONS.md` / `ARCHITECTURE.md`. Não implementar arquitetura importante antes de a decisão estar clara.

## 27. Workflow de debugging

- Começar com Sonnet Medium.
- Se for difícil, Sonnet High.
- Só depois de evidência de que não basta, Opus High.

Não começar debugging automaticamente em Opus High.

## 28. Workflow de documentação

Documentação comum: Sonnet Low/Medium, ou equivalente suficiente. Nunca usar Opus High só para atualizar README, PROGRESS, DECISIONS, changelog, comentários ou documentação simples.

## 29. Workflow de exploração do codebase

Exploração simples deve ser barata.

- **Preferir:** busca direcionada, grep, leitura de arquivos específicos e agentes leves só quando realmente necessários.
- **Evitar:** ler o repositório inteiro, vários agentes explorando a mesma área, Opus analisando arquivos de forma mecânica.

## 30. Quando parar e avisar o usuário

Parar antes de executar e avisar quando:

- recomendar mudança de modelo;
- recomendar mudança significativa de effort;
- houver necessidade de Opus ou de Extra High;
- estiver prestes a criar muitos subagentes;
- uma tarefa puder consumir muito contexto;
- houver conflito arquitetural;
- houver mudança importante fora do plano;
- houver risco significativo de segurança;
- uma revisão extra cara estiver sendo considerada.

## 31. Formato da avaliação antes de tarefas relevantes

Curto. Exemplo:

```text
MODEL ROUTING

Task: integração Google Drive
Modelo recomendado: Sonnet
Effort: High
Risco: médio/alto
Subagentes: 1 security reviewer somente no final
ECC sugerido:
- tdd-workflow
- code-review
- security-scan
- verification-loop

Motivo:
Integração externa com OAuth/permissões exige raciocínio e security review,
mas não justifica Opus inicialmente.
```

Depois, executar.

## 32. Não sobrecarregar o fluxo do usuário

Não transformar estas regras em burocracia. Para tarefas simples, o aviso pode ter só 2 a 4 linhas. O objetivo da política é **reduzir** tokens, não criar mais texto. Evitar explicações longas sobre model routing, salvo quando necessário.

## 33. Regra de ouro

- Padrão: **Sonnet + Medium**.
- Escalar para **Sonnet + High** quando necessário.
- Escalar para **Opus + High** só para problemas realmente complexos.
- **Extra High** é excepcional.

## 34. Agentes de review

Reviews são caros, porque cada agente pode carregar contexto e raciocinar sobre muitos arquivos. Portanto:

- limitar o escopo ao diff ou milestone quando possível;
- não revisar o repositório inteiro sem necessidade;
- dizer explicitamente quais arquivos e módulos mudaram;
- evitar vários revisores analisando o mesmo conteúdo;
- usar santa-loop só em milestones críticos;
- usar security reviewer só quando o risco justificar;
- preferir Sonnet para code review normal;
- usar revisor Opus só quando complexidade ou criticidade justificarem.

## 35. Política para milestones

| Tipo | Fluxo |
|---|---|
| Feature normal | code-review → verification-loop |
| Feature frontend | code-review → verification-loop → browser-qa |
| Feature sensível | code-review → security-scan → verification-loop → browser-qa se aplicável |
| Milestone importante | code-review → security-scan se aplicável → verification-loop → quality-gate |
| Pré-entrega / milestone crítico | code-review → security-scan → verification-loop → santa-loop se houver benefício real → quality-gate |

## 36. Estado desta política

Depois de criar este documento e atualizar o `CLAUDE.md`, fazer uma auditoria rápida do setup com `/ecc:context-budget`, `/ecc:cost-report` e `/ecc:harness-audit`, quando disponíveis. Não fazer mudanças destrutivas nem grandes reconfigurações automaticamente. Apresentar:

1. fontes atuais de desperdício de tokens;
2. recomendações;
3. configuração padrão sugerida;
4. mudanças no ECC que valham a pena;
5. confirmação de que a política foi persistida.

## 37. A partir deste momento

Todas as novas sessões e tarefas relevantes deste projeto respeitam esta política. Antes de qualquer tarefa relevante:

1. classificar a complexidade;
2. escolher o modelo;
3. escolher o effort;
4. avaliar a necessidade de agentes;
5. avaliar o workflow do ECC;
6. evitar redundância;
7. só então trabalhar.

Objetivo permanente: **qualidade + confiabilidade + segurança + eficiência de tokens**. Nunca maximizar recursos por padrão. Usar sempre só os recursos necessários para executar a tarefa corretamente.

## 38. Avaliação de tokens no início de cada fase (obrigatória)

Antes de iniciar **cada fase** (e qualquer auditoria ou etapa grande), o assistente apresenta ao usuário, junto do MODEL ROUTING, uma avaliação curta de tokens. Não depende de o usuário pedir.

1. **Contexto atual:** a sessão está longa? Se sim, recomendar `/compact` **antes** de começar (cada chamada relê o contexto inteiro).
2. **Custo esperado da fase:** pequeno (leitura e interface), médio (novo serviço com testes) ou grande (IA, auditoria com subagente), em número aproximado de chamadas.
3. **Modelo e effort:** padrão Sonnet + Medium; só subir com justificativa.
4. **Subagentes:** só com ganho claro (auditoria independente, no máximo um).
5. **Plano B:** o que será cortado ou adiado se o limite apertar (teste de menor risco primeiro).
6. **Registro:** o número de chamadas ao modelo de IA do produto e o custo em US$ entram no `VALIDACAO.md` quando houver.

Registrada por pedido do usuário em 2026-09-30.
