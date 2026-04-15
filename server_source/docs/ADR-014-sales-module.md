# ADR-014 — Sales Module

## Contexto

O SOI da Viníssimo já possuía `AUTH`, `Produtos`, `Clientes` e `Compras` aprovados, com schema isolado em `soi` e operação privada via `api` e `web`. Faltava o módulo de `Vendas` para registrar pedidos multicanal, calcular receita/custo/lucro/margem, sinalizar preço abaixo do mínimo e gerar saída operacional de estoque.

## Endpoints criados

- `GET /api/v1/sales`
- `POST /api/v1/sales`
- `GET /api/v1/sales/:saleId`
- `PATCH /api/v1/sales/:saleId`

## Decisões de modelagem

- `POST /sales` aceita múltiplos itens por pedido.
- O custo por item vem de `soi.product_cost_snapshots.current_unit_cost`; produtos sem snapshot de custo atual não podem ser vendidos pelo módulo.
- A taxa do canal e a margem mínima alvo são lidas da configuração corrente em `soi.v_current_system_settings`.
- O cálculo do preço mínimo por canal usa a combinação de custo unitário, taxa do canal e `margin_min_target`.
- `below_min_price_flag` é calculado comparando o preço efetivo praticado por unidade, já considerando o desconto do item, com o preço mínimo calculado para o canal.
- Ao criar uma venda em status diferente de `canceled`, o módulo grava `sale_out` em `soi.inventory_movements`.
- `PATCH /sales/:saleId` fica restrito ao cabeçalho/status (`saleNumber`, `customerId`, `orderStatus`, `notes`) e não recalcula itens, nem reverte ou recria movimentos.

## Decisões de UX

- A lista de vendas prioriza leitura rápida de canal, status, receita líquida e lucro bruto.
- A tela de nova venda mostra prévia operacional por item, incluindo taxa do canal, custo corrente, lucro, margem e sinalização de preço mínimo.
- A tela de detalhe congela os itens após a gravação e explicita que a edição está restrita ao cabeçalho/status para preservar auditoria.

## Consequências

- O módulo fica funcional e auditável sem introduzir edição destrutiva de itens no MVP.
- O cálculo depende da existência de snapshot de custo atual para cada produto vendido.
- Alterações posteriores de status no `PATCH` não fazem reconciliação automática de estoque; essa decisão fica documentada para evolução futura.

## Próximos passos

- Evoluir a reconciliação de estoque para mudanças posteriores de status, especialmente cancelamento pós-gravação.
- Integrar o módulo com leitura mais rica de política comercial por canal, caso surjam regras adicionais além da taxa e margem mínima.
- Expor alertas operacionais de preço abaixo do mínimo e margem crítica no dashboard futuro.
