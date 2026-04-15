# ADR-037 — Fechamento de integridade comercial (métricas de cliente + recebíveis)

## Contexto
A auditoria funcional apontou dois riscos críticos de dados:
1. possível desatualização de `soi.customer_metrics` em transições de venda;
2. potencial ausência de retroatividade de `soi.financial_receivables` para vendas históricas.

## Verificação técnica
### Métricas de cliente
No fluxo de vendas, após `create` e `update`, o backend executa sincronização de métricas por cliente com base em vendas `delivered`, recalculando:
- `first_purchase_at`
- `last_purchase_at`
- `orders_count`
- `total_revenue`
- `avg_ticket`
- `customer_status`

### Recebíveis retroativos
No módulo financeiro, existe sincronização baseline (`runBaselineSync`) que percorre fontes existentes e sincroniza:
- `syncReceivableForSale`
- `syncPayableForPurchase`
- `syncPayableForExpense`

Isso cobre cenário retroativo quando o módulo financeiro passa a operar sobre dados já existentes.

## Decisão
Encerrar a fase com:
1. auditoria SQL operacional formalizada (`bin/check-commercial-integrity.sh`);
2. execução da auditoria com relatório versionado em backup;
3. registro explícito da cobertura técnica para evitar ambiguidade futura.

## Evidência desta fase
- backup: `/opt/vinissimo/soi/backups/phase5_commercial_integrity_<timestamp>`
- relatório desta execução:
  - `METRIC_MISMATCH_COUNT = 0`
  - `DELIVERED_WITHOUT_RECEIVABLE = 0`

Observação operacional: no momento da auditoria, a base estava com `0` vendas `delivered`, portanto não houve lacuna de cobertura detectável no recorte atual.

## Consequências
- Elimina incerteza documental sobre os dois riscos críticos de dados.
- Mantém check recorrente simples para rodada de go-live e pós-go-live.
- Preserva escopo sem reabrir módulos.

## Próximos passos
- Executar `bin/check-commercial-integrity.sh` ao final de cada janela de carga histórica.
- Em caso de divergência (`METRIC_MISMATCH_COUNT > 0` ou `DELIVERED_WITHOUT_RECEIVABLE > 0`), abrir hotfix focal imediatamente.
