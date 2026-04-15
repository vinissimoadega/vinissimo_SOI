# T8 — Revisão de Queries e Índices

## Contexto
Rodada executada no Gate C para reduzir custo de busca/filtros nos módulos operacionais, sem alterar semântica de negócio.

## Fontes auditadas
- `apps/api/src/products/products.service.ts`
- `apps/api/src/customers/customers.service.ts`
- `apps/api/src/sales/sales.service.ts`
- `apps/api/src/purchases/purchases.service.ts`
- `apps/api/src/inventory/inventory.service.ts`
- `apps/api/src/financial/financial.service.ts`
- `apps/api/src/crm/crm.service.ts`

## Decisão técnica
1. Manter todos os índices já existentes.
2. Adicionar `pg_trgm` + índices GIN para buscas `ILIKE` de alto uso.
3. Adicionar índices compostos para filtros/ordenação frequentes em vendas, financeiro, inventário, CRM e despesas.
4. Aplicar via migration versionada (`V4__Performance_Indexes.sql`) para rollback/auditoria.

## Resultado
- Migration aplicada: `V4__Performance_Indexes.sql`
- Novos índices criados: **25**
- Evidência nominal: `backups/execution_gateC_t8_20260415_122620/reports/indexes_added_t8.txt`
- Regressão funcional:
  - `run-smoke.sh`: PASS 6/6
  - `run-critical.sh`: PASS 10/10

## Observações
- Não houve alteração de payloads/rotas.
- Não houve mudança de regra de domínio.
- Foco exclusivo em performance de consulta e estabilidade operacional.
