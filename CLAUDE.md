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

## Regras inegociáveis

- Só dados fictícios. Nunca credenciais ou segredos no repositório.
- Drive só leitura. A IA nunca altera atividade oficial sem aprovação humana.
- Não codificar comportamento específico dos dados de teste (a banca usa cenários novos).
- Perguntas e decisões que dependem do usuário são apresentadas no terminal.
