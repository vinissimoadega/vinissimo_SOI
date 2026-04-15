# ADR-023: Dashboard real v1

## Contexto

O SOI da Viníssimo já opera com módulos reais de produtos, clientes, compras, vendas e estoque. A base reconciliada atual contém 117 produtos reais com custo, sem itens demo remanescentes na leitura operacional. Ainda existem 3 pendências explícitas fora da base reconciliada atual:

- 2 SKUs não encontrados no cadastro
- 1 item sem SKU

O dashboard bootstrap anterior usava fallback visual e não podia mais ser a leitura principal do negócio.

## Endpoints criados

- `GET /api/v1/dashboard/overview`

O endpoint retorna:

- resumo executivo
- resumo de estoque
- visão por canal
- distribuição de clientes por status
- alertas operacionais
- produtos em atenção
- cobertura da base
- pendências da base reconciliada

## Decisões de modelagem

- O dashboard usa apenas a base reconciliada atual.
- As pendências fora da base foram codificadas explicitamente no módulo para não depender de leitura runtime de artefatos de backup.
- O bloco executivo usa somente pedidos `delivered`.
- O bloco de estoque reaproveita a mesma semântica operacional validada no módulo de estoque:
  - saldo derivado por movimentos
  - mínimo sugerido por giro
  - mínimo usado como maior entre manual e sugerido
  - semáforos `ruptura`, `repor_agora`, `atencao`, `ok`
- A distribuição de clientes usa a mesma semântica validada do módulo de clientes:
  - `lead`, `novo`, `recorrente`, `inativo`

## Decisões de UX

- O dashboard bootstrap/fallback foi substituído por leitura real.
- O shell atual foi preservado.
- O layout segue blocos operacionais claros, priorizando leitura e decisão:
  - resumo executivo
  - estoque
  - canais
  - clientes
  - alertas
  - pendências da base
- As 3 pendências da base aparecem explicitamente em um bloco próprio e também geram alerta.

## Consequências

- A leitura do dashboard passa a refletir apenas dados reais reconciliados.
- Itens ainda fora da base não contaminam KPI, mas ficam visíveis para governança da operação.
- A leitura executiva e operacional fica centralizada em um único endpoint do backend.

## Próximos passos

- Evoluir o dashboard com filtros de janela temporal quando houver necessidade executiva real.
- Adicionar séries históricas quando a base operacional tiver volume suficiente.
- Mover as pendências da base para uma tabela operacional dedicada quando a governança de reconciliação deixar de ser residual.
