# ADR-021 - Cost Coverage Prioritization

## Contexto

A base real da Viníssimo foi saneada e já teve a carga inicial de estoque e uma carga complementar parcial de custo. No estado atual existem 117 produtos reais, dos quais 47 possuem snapshot de custo e 70 ainda não possuem custo operacional registrado em `soi.product_cost_snapshots`.

Desses 70 produtos sem custo, 35 ainda possuem saldo atual derivado por movimentos. Isso impacta diretamente leituras operacionais que dependem de custo, como capital empatado, preço mínimo por canal e indicadores financeiros futuros do dashboard real.

Antes de construir o dashboard real, a operação precisa de uma fila objetiva de preenchimento de custo que priorize os itens com saldo atual.

## Decisão

Foi criada uma planilha operacional editável de saneamento de custo em `backups/cost_coverage_prioritization_20260402_081500/cost_completion_worklist.xlsx`.

A planilha usa as colunas:

- `sku`
- `nome`
- `saldo atual`
- `custo atual`
- `status de preenchimento`
- `prioridade`
- `observação`

A priorização definida é:

- `P1`: produto com saldo atual e sem snapshot de custo
- `P2`: produto sem saldo atual e sem snapshot de custo

O campo `custo atual` permanece em branco para preenchimento operacional. Nenhum custo foi inferido ou inventado nesta etapa.

## Consequências

- A operação passa a ter uma fila única e editável para completar a cobertura de custo.
- Os 35 itens `P1` devem ser saneados primeiro, porque já afetam leituras operacionais correntes.
- Os 35 itens `P2` podem ser saneados em seguida, sem bloquear a operação diária imediata.
- O dashboard real não deve ser liberado enquanto houver volume relevante de produtos com saldo sem custo.

## Próximos passos

1. Preencher os custos atuais dos itens `P1`.
2. Aplicar a carga complementar dos custos preenchidos na planilha.
3. Repetir o processo para os itens `P2`.
4. Revalidar capital empatado, preços mínimos por canal e cobertura de custo antes do dashboard real.
