# ADR-018 — Cost Import Mapping

## Contexto
A carga inicial do estoque real da Viníssimo foi executada apenas com saldo derivado por movimentos, sem atualização de custo, porque a planilha anterior não trazia custo operacional explícito.

A planilha atualizada de estoque real agora apresenta uma coluna dedicada a custo de compra por garrafa, o que viabiliza uma segunda etapa controlada para atualização de `soi.product_cost_snapshots`.

## Estrutura Inspecionada
- Aba: `ImportedProducts`
- Intervalo útil: `A1:G121`
- Linhas de dados: `120`
- Colunas:
  - `Código de Barras`
  - `Nome`
  - `Preço`
  - `Qtd. Atual Estoque`
  - `Ativo`
  - `Preço em Promoção`
  - `Preço de compra`

## Comparação com a Importação Anterior
Na importação anterior, a estrutura operacional utilizada era:
- `Código de Barras` -> SKU
- `Nome` -> nome
- `Qtd. Atual Estoque` -> quantidade atual
- `Ativo` -> status do produto
- `Preço` era tratado apenas como informação comercial e não como custo

Na planilha atualizada:
- a coluna `Preço` continua representando preço comercial
- existe uma nova coluna explícita `Preço de compra`
- a coluna `Preço de compra` é a candidata correta para mapear `current_unit_cost`

## Mapeamento Proposto
- `sku` <- `Código de Barras`
- `name` <- `Nome`
- `current_stock_qty` <- `Qtd. Atual Estoque`
- `current_unit_cost` <- `Preço de compra`

## Regra de Segurança Proposta para a Migração de Custo
A futura carga de custo deve atualizar snapshot apenas quando todos os critérios abaixo forem verdadeiros:
- SKU presente e não vazio
- SKU único na planilha
- custo presente
- custo numérico válido
- custo maior ou igual a zero
- produto já existente no SOI por SKU, ou criação explicitamente aprovada se faltar produto

Linhas fora desses critérios devem permanecer em pendência operacional.

## Resultado da Inspeção Atual
- linhas totais de dados: `120`
- linhas com custo presente: `48`
- linhas aptas para atualização de snapshot de custo: `47`
- linhas pendentes: `1`
- duplicidades de SKU na planilha: `0`
- custos inválidos: `0`

Pendência identificada:
- linha `112`: `Mataojo Merlot` sem `Código de Barras`, embora com `Preço de compra = 49.9`

## Decisão
O mapeamento de custo é considerado seguro para preparação da próxima migração complementar, usando:
- `Código de Barras` como SKU
- `Preço de compra` como custo operacional atual por garrafa

A coluna `Preço` não deve ser usada como custo.

## Consequências
- a próxima migração complementar poderá atualizar `soi.product_cost_snapshots` com boa previsibilidade para `47` linhas
- `1` linha deve continuar em pendência até receber SKU válido
- categoria e fornecedor continuam ausentes nesta planilha e não devem ser inferidos nesta etapa

## Próximos Passos
1. confirmar a semântica final de `Qtd. Atual Estoque` se houver qualquer revisão operacional adicional
2. executar migração complementar apenas dos snapshots de custo
3. emitir relatório de reconciliação entre SKU da planilha e SKU existente no SOI
4. manter a linha sem SKU em fila de saneamento manual
