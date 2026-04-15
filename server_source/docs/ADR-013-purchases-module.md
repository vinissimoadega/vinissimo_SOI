# ADR-013 — Módulo de compras

## Contexto

O SOI da Viníssimo precisava registrar compras com múltiplos itens, custo real por linha e efeito operacional imediato sobre entrada de estoque e custo atual dos produtos.

O schema já dispunha de `purchase_orders`, `purchase_order_items`, `inventory_movements` e `product_cost_snapshots`, mas o módulo ainda não estava implementado no backend e no frontend.

## Endpoints criados

- `GET /api/v1/purchases`
- `POST /api/v1/purchases`
- `GET /api/v1/purchases/:purchaseId`
- `PATCH /api/v1/purchases/:purchaseId`

## Decisões de modelagem

- uma compra aceita múltiplos itens na criação
- `total_cost` por item é calculado como `unit_cost * quantity + freight_allocated + extra_cost_allocated`
- `real_unit_cost` é calculado como `total_cost / quantity`
- cada item gera um `inventory_movements.movement_type = purchase_in`
- `product_cost_snapshots` é atualizado pelo item de compra mais recente aplicável para cada produto
- o `PATCH` foi mantido restrito ao cabeçalho (`purchaseNumber`, `supplierId`, `notes`) para preservar a trilha auditável de itens, movimentos e custo operacional

## Decisões de UX

- lista de compras com filtros por fornecedor, produto e intervalo de datas
- formulário de nova compra com múltiplas linhas de item e prévia de custo total
- detalhe da compra com edição só do cabeçalho e itens em modo leitura
- layout preservado no padrão já usado pelos módulos anteriores

## Consequências

- o módulo já produz trilha auditável de entrada de estoque e atualização de custo
- a edição de itens após a gravação não faz parte deste MVP e ficou explicitamente fora do `PATCH`
- o fluxo prepara a base para futuras integrações com estoque e vendas sem abrir esse escopo agora

## Próximos passos

- adicionar módulo dedicado de fornecedores quando entrar no escopo autorizado
- consolidar telas de conciliação e histórico por produto
- revisar regras de edição/cancelamento de compra quando o módulo de estoque estiver em produção
