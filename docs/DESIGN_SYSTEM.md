# Design system da Central da Liga IA

> Redesign do frontend (DEC-026, 2026-09-30). Fonte dos valores: `src/app/globals.css`. Os pares de cor e os valores de `PALETTE` estão em `src/lib/contrast.ts`; o teste `contrast.test.ts` falha se o CSS divergir da paleta ou se algum par ficar abaixo de 4,5:1.

## Direção

Ferramenta de trabalho para uma liga universitária: calma, densa e legível. A marca vem da logo (índigo `#32439B`); o resto é neutro. Sem gradiente, sem brilho, sem vidro, sem sombra decorativa. Movimento só funcional, e `prefers-reduced-motion` desliga transições.

Regra de ouro herdada: **nenhum estado depende só de cor.** Todo selo, aviso e erro tem texto.

## Cores

| Token | Valor | Uso |
|---|---|---|
| `--primary` | `#32439B` | Marca, links, botão primário, aba ativa |
| `--primary-hover` | `#28367F` | Hover do botão primário |
| `--primary-soft` | `#EDEFFA` | Fundo de aviso informativo e aba ativa no menu do celular |
| `--on-primary` | `#FFFFFF` | Texto sobre `--primary` |
| `--bg` | `#F6F7FB` | Fundo da página |
| `--surface` | `#FFFFFF` | Cartões, cabeçalho, campos |
| `--surface-muted` | `#ECEEF6` | Citações, blocos secundários, selo neutro |
| `--border` | `#D3D8E6` | Divisórias e contorno de cartões (decorativo) |
| `--border-strong` | `#7C84A0` | Contorno de campos e botões (≥ 3:1, WCAG 1.4.11) |
| `--text` | `#151A2D` | Texto principal |
| `--text-muted` | `#525A73` | Texto secundário (≥ 6:1 sobre `--bg`) |
| `--success-ink` / `--success-bg` | `#166534` / `#DCFCE7` | Concluído, aceito |
| `--warning-ink` / `--warning-bg` | `#8A4B08` / `#FDF1D3` | Atenção, prazo próximo, a confirmar (âmbar) |
| `--error-ink` / `--error-bg` | `#991B1B` / `#FEE2E2` | Erro, bloqueio, vencido |
| `--focus` | `#32439B` | Anel de foco (3 px, deslocado 2 px) |

O ciano e o azul `#1433BD` do protótipo anterior foram removidos. O periwinkle da logo (`#788BD7`) não é usado em texto.

## Tipografia

IBM Plex Sans (interface) e IBM Plex Mono (IDs como `ACT-101` e datas do histórico), servidas por `@fontsource` no próprio app: nada vem de CDN, a banca roda offline. Só o subset `latin` (cobre o português).

| Papel | Classe | Observação |
|---|---|---|
| Título de página | `text-2xl font-semibold tracking-tight` | um `h1` por tela |
| Título de seção | `text-base`/`text-lg font-semibold` | `h2` |
| Corpo | 15 px (`body`) | linha 1,55 |
| Apoio, rótulo de dado | `text-sm` / `text-xs text-[var(--text-muted)]` | |
| ID e datas técnicas | `font-mono` | |

## Espaço, raio e sombra

- Espaço: escala de 4 px do Tailwind (`p-4`, `gap-3`...), sem tokens próprios.
- Dois raios: `--radius` 6 px (`rounded-md`: botões, campos, selos) e `--radius-lg` 10 px (`rounded-lg`: cartões).
- Sem sombras. Se uma camada sobreposta (menu, diálogo) for criada, definir o token de sombra junto com ela.

## Componentes

| Componente | Arquivo | Notas |
|---|---|---|
| `Button`, `ButtonLink`, `buttonClass` | `components/ui/button.tsx` | Variantes `primary`, `secondary`, `danger`, `ghost`; tamanhos `sm` (32 px) e `md` (40 px). Link que parece botão usa o mesmo estilo |
| `SubmitButton` | `components/submit-button.tsx` | Botão de Server Action com `useFormStatus` e rótulo de andamento |
| `Field`, `CONTROL` | `components/ui/field.tsx` | Rótulo visível + dica; `CONTROL` é a aparência única de input, select e textarea |
| `Card` | `components/ui/card.tsx` | Superfície branca com contorno |
| `EmptyState` | `components/ui/empty-state.tsx` | Vazio com título e o que fazer; sem "(0)" nem caixa em branco |
| `StatusBadge` | `components/status-badge.tsx` | Texto sempre; sem ícone decorativo; tons `ok`, `warn`, `danger`, `info`, `neutral` |
| `Notice` | `components/notice.tsx` | Faixa com borda à esquerda e prefixo em texto; `role="alert"` só para erro |
| `PageHeader` | `components/page-header.tsx` | Título, descrição e uma ação principal à direita |
| `MainNav` | `components/main-nav.tsx` | Abas no topo; no celular, botão "Menu" (`aria-expanded`) que fecha ao navegar |
| `ActivityCard` | `components/activity-card.tsx` | ID em mono, título, selos, responsável/prazo/frente em linha, próximo passo e fonte |

## Padrões de tela

- **Início:** responde "o que faço agora?" com a próxima atividade da persona em destaque e as seguintes. Sem a grade de seis cartões (a navegação já é o topo).
- **Atividades:** lista densa (cerca de 130 px por item no desktop, 230 px no celular, contra mais de 300 px antes).
- **Sugestão:** duas colunas no desktop. Esquerda: tabela "Campo / Atual / Proposto" e evidência. Direita: decisão fixa (aceitar em destaque, "Ajustar" recolhido, rejeitar com motivo).
- **Atividade (detalhe):** dados e histórico à esquerda; ações e fontes à direita.
- **Formulários:** duas colunas a partir de `md`; erro em texto ligado ao campo e resumo com links no topo.
- **Páginas de leitura** (Comece aqui, Como decidimos): coluna de até 56 rem.

## Acessibilidade

- Foco visível em todos os controles (`:focus-visible`, 3 px).
- Alvos de toque ≥ 24 px (botões `sm` 32 px, `md` 40 px; abas ≥ 36 px e itens do menu do celular 40 px).
- `skip-link`, landmarks (`header`, `nav` com nome, `main`, `footer`), um `h1` por página, `aria-current="page"` na aba ativa.
- Tabelas com `caption` (visível só a leitores de tela) e `scope`.
- Verificado por axe (WCAG 2.0/2.1/2.2 A e AA) em 9 telas no E2E, e por teste de escala de cinza (todo selo tem texto). O axe cobre só parte do WCAG: a conferência manual com teclado e leitor de tela segue pendente (V-14).

## Responsivo

- Teste automático a 375 px: nenhuma tela rola na horizontal.
- Cabeçalho: marca + persona numa linha no desktop; empilhados no celular. Abas viram "Menu" abaixo de `md` (768 px).
- Tabela de arquivos (Sincronização) mantém `min-w-[40rem]` e rola dentro do próprio contêiner; é o único valor fixo de largura do sistema.

## Regras de uso

1. Cor, raio e fonte só por token. Não escrever hex nem `rounded-[..]` em componentes.
2. Botão novo = `Button`/`ButtonLink`. Campo novo = `CONTROL` ou `Field`.
3. Estado novo = `StatusBadge` ou `Notice` com texto.
4. Ao mudar uma cor, mudar `globals.css` **e** `lib/contrast.ts`; o teste confere os dois.
