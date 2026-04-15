# ADR-015 — Reconciliação semântica de status de vendas

## Contexto

O módulo de vendas já permitia criar pedidos com múltiplos itens e calculava receita, custo, lucro e margem por item e por pedido. Porém, a primeira versão gerava `sale_out` na criação da venda sem considerar corretamente o ciclo de vida operacional do pedido.

O próprio módulo já permitia `PATCH` do cabeçalho e do `order_status`, mas a mudança de status não reconciliava os movimentos em `soi.inventory_movements`. Isso deixava três riscos antes do futuro módulo de estoque:

- pedidos `pending` podiam ser tratados como baixa efetiva cedo demais;
- pedidos `delivered` não tinham garantia de baixa idempotente ao longo do ciclo de vida;
- pedidos `canceled` não revertiam a baixa anterior de forma consistente.

## Decisão

A reconciliação de estoque da venda passa a ser derivada do `order_status` do pedido, com a seguinte regra semântica:

- `pending`: impacto líquido desejado no estoque = `0`
- `delivered`: impacto líquido desejado no estoque = `-quantity` por item, via `sale_out`
- `canceled`: impacto líquido desejado no estoque = `0`; se já houver baixa líquida, a reversão deve ser gravada com `cancel_reversal`

A implementação passa a reconciliar os movimentos por item de venda usando `source_type = 'sales_order_item'` e `source_id = sales_order_items.id`.

## Endpoints afetados

- `POST /api/v1/sales`
- `PATCH /api/v1/sales/:saleId`
- `GET /api/v1/sales`
- `GET /api/v1/sales/:saleId`

## Regras operacionais aplicadas

### Criação da venda

- a criação não insere mais `sale_out` de forma cega;
- após gravar os itens, o backend reconcilia o impacto desejado conforme o status informado;
- assim, uma venda criada como `pending` nasce sem baixa efetiva;
- uma venda criada como `delivered` nasce com a baixa efetiva correta;
- uma venda criada como `canceled` nasce sem baixa efetiva.

### Mudança de status

- `pending -> delivered`: grava `sale_out` somente se o item ainda não tiver baixa líquida;
- `delivered -> canceled`: grava `cancel_reversal` somente se o item ainda estiver com baixa líquida aplicada;
- `delivered -> pending`: reverte para impacto líquido zero, com o mesmo mecanismo de reconciliação;
- mudanças repetidas para o mesmo status são idempotentes e não duplicam movimentos.

### Integridade

- se o histórico do item já estiver em estado inesperado no momento da reconciliação, o backend responde com erro de conflito em vez de mascarar uma inconsistência operacional;
- não foi introduzido delete físico;
- o vínculo entre pedido, item e movimento permanece auditável.

## Decisões de modelagem

- o cálculo usa a soma líquida de `quantity_delta` por `sales_order_item` como fonte de verdade para decidir se falta baixar, reverter ou não fazer nada;
- `sale_out` continua sendo o evento de baixa efetiva;
- `cancel_reversal` passa a ser o evento explícito de reversão quando o pedido deixa de exigir baixa líquida.

## Decisões de UX

- o frontend mantém a edição de status no detalhe da venda, porque isso agora produz reconciliação semântica correta no backend;
- a auditoria permanece centrada no detalhe da venda e nos movimentos associados, sem introduzir edição destrutiva de itens.

## Consequências

- o módulo de vendas deixa de depender de interpretação manual para saber se houve baixa efetiva;
- o ciclo `pending -> delivered -> canceled` passa a ser rastreável e reconciliado no próprio módulo de vendas;
- o módulo de estoque poderá partir de movimentos já semanticamente consistentes.

## Próximos passos

- expor no módulo de estoque a visão consolidada do impacto líquido por produto;
- considerar trilha explícita de transição de status por pedido;
- avaliar alertas operacionais para pedidos com histórico inconsistente de movimentos.
