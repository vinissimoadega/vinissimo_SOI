# ADR-022 - P1 Cost Import Finalization

## Contexto

A base real da Viníssimo já passou pela carga inicial de estoque, pela complementação parcial de custo e pela priorização operacional da cobertura de custo. O diagnóstico vigente antes desta rodada era:

- 117 produtos reais
- 47 com snapshot de custo
- 70 sem snapshot de custo
- 35 produtos `P1` com saldo atual e sem custo

A primeira tentativa de finalização dos `P1` foi bloqueada porque a worklist disponível no diretório autorizado estava sem `current_unit_cost` preenchido. Nesta nova rodada, a planilha atualizada foi reinspecionada diretamente e trouxe a coluna `Preço de compra` preenchida.

## Reinspeção da planilha atualizada

Resultado da reinspeção antes de qualquer escrita:

- 120 linhas de dados na aba `ImportedProducts`
- 119 linhas com SKU válido
- 120 linhas com custo preenchido e numérico válido
- 117 linhas reconciliadas com produtos reais já existentes no SOI
- 3 linhas pendentes

Pendências preservadas sem chute:

- `7808725410158 | Chilano Dark Blend` -> SKU não encontrado nos produtos atuais
- `7808725400340 | Chilano Syrah` -> SKU não encontrado nos produtos atuais
- `Mataojo Merlot` -> linha sem SKU

## Decisão

Aplicar a carga complementar final de custo por SKU reconciliado, usando apenas as 117 linhas elegíveis.

Regras mantidas:

- `Preço de compra` é a única coluna usada como custo
- `Preço` não é custo
- não recalcular saldo
- não criar `inventory_movements`
- não inferir custo por similaridade
- preservar pendências sem SKU ou sem match como pendência manual

## Consequências

- Os 35 produtos `P1` passam a ter cobertura de custo operacional.
- O total de produtos reais com snapshot de custo sobe de 47 para 117.
- Leituras dependentes de custo, como preço mínimo por canal e capital empatado, passam a refletir a base real também para os itens que estavam sem snapshot.
- As 3 linhas pendentes continuam fora da carga e exigem saneamento manual específico.

## Próximos passos

1. Resolver manualmente os 2 SKUs da planilha que ainda não existem no cadastro atual.
2. Resolver a linha sem SKU (`Mataojo Merlot`) sem inferência manual.
3. Reexecutar uma verificação final de cobertura de custo antes do dashboard real.
