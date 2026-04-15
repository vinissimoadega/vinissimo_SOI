# ADR-024 — Importação histórica comercial mínima (registro de lacuna)

## Status
Encerrado sem execução nesta janela.

## Contexto
O número `ADR-024` foi reservado para a rodada de importação histórica comercial mínima (vendas + clientes) sem impacto no estoque atual.

Durante a evolução operacional do SOI, a sequência documental avançou para `ADR-025` sem a publicação formal do registro `ADR-024`, o que gerou ambiguidade de rastreabilidade.

## Decisão
Preencher formalmente a lacuna com este ADR para manter a sequência íntegra.

Este registro documenta que:
- a rodada histórica comercial foi planejada;
- não foi consolidada como entrega concluída nesta janela;
- não houve mudança de semântica de estoque vinculada a esse número de ADR.

## Consequências
- a linha do tempo de ADRs volta a ficar contínua (`001` a `...`);
- auditorias futuras conseguem entender por que o número `024` existe;
- evita interpretação equivocada de “ADR perdido”.

## Próximos passos
Quando a importação histórica comercial for retomada operacionalmente, deve ser aberta nova ADR incremental com:
- escopo executado;
- fontes de dados usadas;
- reconcilição before/after;
- evidência explícita de não alteração de estoque atual.
