@AGENTS.md

# Case técnico — Liga IA UFSCar

Central de contexto e atividades (lê uma pasta do Google Drive, painel de atividades, sugestões de IA com revisão humana).
**Entrega: 2026-10-04 (domingo), 23h59 BRT.**

## Fonte de verdade (consulte antes de qualquer tarefa relevante)

1. `docs/PROGRESS.md`: estado atual, próximos passos, blockers. **Leia primeiro.**
2. `docs/PRD.md`: o que construir (requisitos 🟦 da banca, decisões 🟨 nossas, critérios de aceitação).
3. `docs/ARCHITECTURE.md`: arquitetura vigente.
4. `docs/DECISIONS.md`: decisões técnicas e motivos.
5. `docs/CASE_ANALYSIS.md`: análise dos documentos da banca (`instrucoes_iniciais/`) e dos dados (`dados_ficticios/`).

Se o histórico de conversa divergir desses documentos, **valem os documentos**.
Ao concluir um marco, atualize `PROGRESS.md` e os documentos afetados. As decisões técnicas vão para `DECISIONS.md`.

## Política de execução de IA (obrigatória)

- Leia `docs/AI_EXECUTION_POLICY.md` antes de tarefas relevantes. As regras de modelo, effort, subagentes, contexto e revisão são **obrigatórias**.
- Nenhuma tarefa complexa começa sem um **MODEL ROUTING** curto (modelo, effort, motivo, subagentes). Padrão: **Sonnet + Medium**. Opus, High e subagentes só com justificativa. Se o modelo atual for excessivo ou insuficiente, avise antes de trabalhar.
- Revisão proporcional ao risco. Santa-loop só em milestone crítico ou pré-entrega.
- **Antes de cada fase**, apresentar a **avaliação de tokens** (contexto e `/compact`, custo esperado, modelo, subagentes, plano B): obrigatório, sem o usuário pedir (política §38).

## Regras inegociáveis

- Só dados fictícios. Nunca credenciais ou segredos no repositório.
- Drive só leitura. A IA nunca altera atividade oficial sem aprovação humana.
- Não codificar comportamento específico dos dados de teste (a banca usa cenários novos).
- Perguntas e decisões que dependem do usuário são apresentadas no terminal.
