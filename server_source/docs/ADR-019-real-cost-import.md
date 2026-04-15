# ADR-019 — Real Cost Import

## Contexto
A carga inicial do estoque real da Viníssimo foi feita por movimentos, sem atualização de custo, porque a planilha então disponível não trazia custo explícito. A planilha atualizada passou a expor `Preço de compra`, viabilizando a migração complementar de custo por SKU sem alterar saldo.

## Decisão
A carga complementar de custo usa:
- `Código de Barras` -> `sku`
- `Preço de compra` -> `current_unit_cost`

A coluna `Preço` continua reservada ao preço comercial e não participa da atualização de custo.

## Estratégia aplicada
- gerar staging auditável em CSV
- manter a linha sem SKU em pendência manual
- casar staging com `soi.products` por `sku`
- inserir snapshot novo quando o produto ainda não tiver linha em `soi.product_cost_snapshots`
- atualizar o snapshot atual quando já existir linha única para o produto
- não gerar movimentos de estoque
- não recalcular saldo físico

## Preservação de histórico
Como `soi.product_cost_snapshots` mantém unicidade por `product_id`, o histórico anterior da importação foi preservado por:
- backup CSV do estado anterior
- SQL de rollback
- relatório de reconciliação com custo anterior e custo novo

## Consequências
- leituras de preço mínimo por canal passam a refletir custo real por SKU
- `tied_up_capital` passa a refletir custo real para os produtos reconciliados
- a linha sem SKU permanece fora da carga automática

## Próximos Passos
1. tratar a pendência manual da linha sem SKU
2. revisar periodicamente divergências entre custo de compra e custo operacional corrente
3. considerar um histórico dedicado de custo se a operação passar a exigir trilha temporal dentro do banco
