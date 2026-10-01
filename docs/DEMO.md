# Roteiro da demonstração (E-5, E-6) e checklist pré-demo

Duração-alvo: **7 minutos** (limite da banca: 5 a 8). A banca entrega um arquivo fictício no padrão das atas; o roteiro abaixo usa os arquivos do pacote (`dados_ficticios/02_ADICIONAR_DEPOIS_DA_CARGA`) como ensaio e trata o arquivo da banca da mesma forma.

## Checklist pré-demo (faça com 30 min de folga)

- [ ] **Reautorizar o Google** (a autorização em modo de teste expira em 7 dias): *Estado da sincronização › Reconectar conta Google*. Deve aparecer "Conectado".
- [ ] `.env.local` com `AI_DEBOUNCE_SECONDS=0` (ou até 10) e `SYNC_INTERVAL_SECONDS=30`, para a ata ser analisada logo. Reinicie o app depois de mudar.
- [ ] `ANTHROPIC_API_KEY` preenchida (sem ela a análise fica desligada). Custo esperado do ensaio e da demo: abaixo de US$ 0,10.
- [ ] App em pé: `npm run app` e **`http://localhost:3000`** (não `127.0.0.1`). Rede estável.
- [ ] Pasta do Drive com **só** o conteúdo de `01_CARGA_INICIAL`. Em *Estado da sincronização*: "6 processado(s)" e "Fonte das atividades: `Ata_registro.xlsx`, aba `Atividades`".
- [ ] Conferir as personas: **Ana** vê ACT-101 e ACT-104; **Davi** vê ACT-102 e ACT-104; **Carla** vê ACT-103.
- [ ] Arquivos da demonstração **à mão, fora da pasta**: `Ata_2026-10-03.md` (ou o `.docx` já convertido em Google Doc), `Ata_2026-10-04.md` e `Ata - copia vazia.xlsx`.
- [ ] Abas abertas: o app, a pasta do Drive e (para o caso de problema) esta página.
- [ ] **Ensaio cronometrado** feito pelo menos uma vez, com uma pasta e um banco limpos (`npm run data:clear`, depois reconectar e sincronizar).
- [ ] Nenhuma tela com segredo à vista (cuidado ao compartilhar a tela: `.env.local`, console do Google Cloud).

## Roteiro

| Tempo | O que mostrar | O que dizer |
|---|---|---|
| 0:00 | **Início** com a persona Ana: "Sua próxima ação" (ACT-101). Abas do topo | "Seis áreas. A pessoa vê o que é dela primeiro. O app só lê o Drive e a IA só propõe." |
| 0:45 | *Estado da sincronização*: pasta, escopo só leitura, "Fonte das atividades" apontada pelo `INDEX.md`, lista de arquivos com a classe de autoridade | "A planilha oficial é a que o índice aponta. Os documentos antigos e os sem autoridade ficam marcados." |
| 1:30 | **Drive → detecção.** No Drive, enviar `Ata_2026-10-03` (Google Doc) **e** `Ata_2026-10-04.md`. Voltar ao app e esperar (ou *Sincronizar agora*) | "Sem tocar no app. Em menos de um minuto aparece como Processado." |
| 2:30 | *Sugestões para revisar* → abrir a de **ACT-101**. Mostrar a tabela atual → proposto (prazo 05/10 → 07/10), o trecho literal da ata e as incertezas | "Cada campo tem evidência literal da fonte. Nada oficial mudou ainda." |
| 3:30 | Trocar para **Bruno** (revisor). **Aceitar como proposto**; mostrar o histórico da atividade (antes → depois, autor, horário) | "A decisão humana é o que muda o valor oficial. Fica tudo no histórico." |
| 4:30 | Sugestão de **nova atividade** (Carla, prazo 10/10) da `Ata_2026-10-04`: aceitar. Mostrar que a **"série diária de notícias"** (ideia sem dono nem prazo) **não virou atividade** | "Hipótese não vira tarefa. Dado ausente fica vazio e marcado como incerto." |
| 5:15 | **Criação manual:** *Nova atividade*, salvar sem título (erro em texto), preencher e salvar | "Também dá para criar à mão, com autor e histórico." |
| 5:45 | **Conflito:** enviar `Ata - copia vazia.xlsx` ao Drive; sincronizar. Mostrar que as atividades continuam e que o arquivo aparece como "sem autoridade / possível conflito" com os motivos | "Arquivo mais novo e de nome parecido não derruba o registro." |
| 6:30 | *Novidades dos documentos* como Ana: o que mudou para ela, com fontes | "O resumo de quem é afetado vem dos registros, sem IA; só o resumo de cada documento vem da IA, rotulado." |
| 7:00 | Fechar: *Como o app decide o valor oficial* (a regra de precedência) | "Esta é a regra, em uma tela." |

## Se a banca entregar um arquivo inesperado

1. Colocar na pasta e esperar a detecção (ou *Sincronizar agora*).
2. **Formato suportado** (`.md`, `.xlsx`, Google Doc): aparece como Processado; se for ata, em até um minuto há sugestões ou a análise diz "sem ação" por trecho.
3. **Formato não suportado** (`.docx`, PDF, imagem): aparece como "formato ainda não processado", com o motivo. É o comportamento correto: "não esperamos que o sistema aceite qualquer formato".
4. **Texto sem estrutura de ata ou com instruções à IA:** nada é inventado, trechos sem evidência são descartados. Mostrar *Trechos sem ação*.

## Plano B

- **OAuth falhou** (expirou, tela de erro): reconectar em *Estado da sincronização*. Sem tempo: `DRIVE_MODE=fake` e `AI_PROVIDER=recorded` (README, seção 3) mostram o painel, as sugestões e a revisão com dados fictícios; avise que não é o Google real.
- **Sem rede ou sem chave da IA:** o app mostra o aviso em texto. O painel, a edição manual e o histórico seguem funcionando; as sugestões já geradas continuam visíveis.
- **Ata não aparece:** *Sincronizar agora*; ver o motivo em *Estado da sincronização* (cada arquivo tem o estado e o motivo). Se a análise ficou "pendente", o botão *Tentar novamente* em *Sugestões para revisar › Documentos analisados*.
- **Estado sujo depois do ensaio:** os eventos são imutáveis. Para recomeçar limpo: `npm run data:clear`, reiniciar, reconectar e sincronizar.
