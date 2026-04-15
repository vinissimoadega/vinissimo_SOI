# ADR-016 — Inventory Module

## Contexto

O SOI da Viníssimo já possui os módulos de autenticação, produtos, clientes, compras e vendas aprovados. O próximo passo operacional é transformar os movimentos já gerados por compras e vendas em leitura consolidada de estoque, sem criar saldo manual no produto.

Também era necessário abrir um fluxo controlado de ajuste manual, com rastreabilidade, e expor preço mínimo por canal a partir do custo operacional atual e das configurações vigentes.

## Decisão

Foi implementado o módulo de estoque com leitura derivada exclusivamente de `soi.inventory_movements` somada ao estoque inicial do produto. O módulo expõe quatro endpoints:

- `GET /api/v1/inventory/status`
- `GET /api/v1/inventory/movements`
- `POST /api/v1/inventory/movements`
- `GET /api/v1/inventory/products/:productId/min-prices`

O cálculo de status por produto usa:

- `current_stock_qty`
- `manual_min_stock_qty`
- `avg_daily_sales_qty`
- `replenishment_lead_time_days`
- `stock_safety_days`
- `suggested_min_stock_qty`
- `used_min_stock_qty`
- `coverage_days`
- `suggested_purchase_qty`
- `tied_up_capital`

Os semáforos finais ficaram definidos assim:

- `ruptura`: estoque atual menor ou igual a zero
- `repor_agora`: estoque atual abaixo do mínimo usado
- `atencao`: estoque atual abaixo de 1,5x do mínimo usado
- `ok`: estoque acima da faixa de atenção

O `POST /inventory/movements` foi limitado a `movement_type = adjustment`, com observação obrigatória, para evitar atalho indevido sobre compras e vendas.

O endpoint de preço mínimo por canal usa o custo atual do produto a partir de `soi.product_cost_snapshots` e as taxas/margem mínima correntes de `soi.v_current_system_settings`.

## Decisões de modelagem

- O saldo atual não é armazenado em campo dedicado; ele é sempre derivado dos movimentos.
- O giro médio diário considera os últimos 30 dias de movimentos líquidos de saída e reversão.
- O mínimo usado é sempre o maior entre o mínimo manual e o mínimo sugerido.
- O capital empatado usa o custo operacional atual mais recente do produto.
- Ajustes manuais ficam com `source_type = manual_adjustment` para facilitar auditoria.

## Decisões de UX

- A tela principal de estoque prioriza semáforo, cobertura, compra sugerida e capital empatado.
- O histórico de movimentos concentra filtros e o formulário de ajuste manual na mesma leitura operacional.
- A leitura de preço mínimo por canal foi deixada como página enxuta por produto, acessível a partir da listagem principal.
- O layout existente do SOI foi preservado, sem redesign ou alteração de branding.

## Consequências

- O módulo de estoque passa a refletir imediatamente os impactos de compras, vendas, reversões e ajustes manuais.
- Ajuste manual ganha rastreabilidade, mas não substitui o fluxo correto de compra e venda.
- A leitura de estoque fica preparada para o dashboard futuro sem introduzir duplicidade de saldo.

## Próximos passos

- Adicionar visão de tendência de ruptura por horizonte de dias.
- Expor alertas agregados por categoria e fornecedor preferencial.
- Revisar, no dashboard futuro, cards de ruptura, repor agora e capital empatado total.
