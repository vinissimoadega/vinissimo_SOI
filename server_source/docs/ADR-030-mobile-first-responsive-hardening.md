# ADR-030 — Mobile-First Responsive Hardening

## Contexto

O SOI da Viníssimo já estava funcional no domínio público, mas o uso real em iPhone revelou sintomas claros de interface desktop comprimida em mobile:

- navegação lateral pouco utilizável em largura reduzida
- topbar apertada e com excesso de elementos no mobile
- listas densas demais para leitura em portrait
- formulários críticos com ações distantes e pouco confortáveis para toque
- páginas operacionais com excesso de horizontalidade

Esta rodada foi limitada ao hardening responsivo mobile-first, sem redesign completo e sem mudança de lógica de negócio.

## Superfícies priorizadas

- Shell autenticado
- Navegação principal
- Dashboard
- `/sales/new`
- `/sales/whatsapp`
- `/inventory/movements`
- `/customers/new`
- `/purchases/new`
- `/expenses`
- listas de `/products`, `/customers`, `/sales`, `/inventory`, `/suppliers` e `/crm`

## Decisões de layout mobile

1. A sidebar desktop foi preservada, mas em mobile passou a existir como drawer.
2. A topbar foi simplificada no mobile, com foco em:
   - botão de navegação
   - busca acessível
   - logout compacto
3. As tabelas densas ganharam fallback automático para cards no mobile.
4. Os CTAs principais passaram a ocupar largura total no mobile quando isso reduz atrito operacional.
5. Paddings, tipografia e alturas mínimas de toque foram ajustados para uso real em largura próxima de 390px.

## Trade-offs aceitos

- Em mobile, a visualização em cards prioriza legibilidade e ação por item em vez de densidade tabular.
- Alguns elementos auxiliares da topbar foram ocultados no mobile para reduzir compressão visual.
- O desktop foi preservado com o mínimo de impacto, então a maior parte da adaptação ficou concentrada abaixo de `md` e `lg`.

## O que mudou por tela

### Shell e navegação

- drawer mobile com abertura e fechamento explícitos
- topbar com menos ruído visual em mobile
- busca mantida acessível sem apertar a barra superior

### Dashboard

- cards mantidos em coluna única no mobile
- respiros e tipografia reforçados
- ações rápidas continuam acessíveis sem overflow horizontal

### Formulários críticos

- botões principais com largura total no mobile quando necessário
- blocos de ação quebrados verticalmente para evitar compressão
- cabeçalhos e ações secundárias reorganizados para toque com uma mão

### Listas e tabelas

- `SimpleTable` passou a renderizar cards no mobile
- paginação e filtros foram reorganizados para empilhamento vertical quando necessário

## Validações

- validação visual em viewport aproximada de iPhone portrait (`390x844`)
- screenshots antes/depois das telas prioritárias
- validação do domínio público preservado
- build do web em produção
- reinício da stack web após patch

## Limitações residuais

- esta rodada não recriou o design visual do produto; ela endureceu o comportamento responsivo do que já existe
- componentes muito específicos e não prioritários ainda podem merecer refinamento fino em uma rodada futura de polimento mobile

