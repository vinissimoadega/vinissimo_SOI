# T9 — Refatoração Controlada de Service Longo

## Alvo
- `apps/api/src/sales/sales.service.ts`

## Motivação
Havia duplicação literal da projeção SQL base da venda entre:
1. `listSales`
2. `getSaleById`

Essa duplicação aumentava custo de manutenção e risco de divergência entre listagem e detalhe.

## Refatoração aplicada
- Extração de método privado:
  - `buildSaleProjectionQuery(whereClause: string)`
- Reuso do mesmo bloco SQL projetado em:
  - `listSales`
  - `getSaleById`

## Garantias
- Sem mudança de payload.
- Sem mudança de regras de negócio.
- Sem mudança de contrato de endpoint.
- Apenas redução de duplicação e centralização da query base.

## Evidência objetiva
- Ocorrências de `COALESCE(additional_costs.additional_cost_total`:
  - antes: 2
  - depois: 1
- Linhas do arquivo:
  - antes: 1359
  - depois: 1323

## Regressão
- Build API executado após patch.
- `run-smoke.sh`: PASS 6/6
- `run-critical.sh`: PASS 10/10
