# ADR-038 — Fechamento da Fase 6 (monitoramento contínuo do plano de correção)

## Contexto
As fases anteriores fecharam as inconsistências críticas levantadas na auditoria:
- sincronização de `customer_metrics` no ciclo de vendas;
- cobertura retroativa de `financial_receivables` no baseline financeiro;
- remediação operacional de host para Docker/deploy.

Faltava transformar isso em rotina operacional contínua para evitar regressão silenciosa.

## Decisão
Instituir checagem recorrente da integridade comercial e de disponibilidade operacional por meio do script:
- `bin/phase6-monitoring-check.sh`

A checagem consolida:
1. consistência de métricas de cliente versus vendas `delivered`;
2. cobertura de recebíveis para vendas `delivered`;
3. saúde mínima da stack (`docker compose ps`, binds, `/login`, `/api/v1/health`);
4. verificação de exposição pública (443 aberto, 3100/4100 fechados externamente).

## Regras de interpretação
- `STATUS=OK`:
  - `METRIC_MISMATCH_COUNT = 0`
  - `DELIVERED_WITHOUT_RECEIVABLE = 0`
- `STATUS=ALERTA`:
  - qualquer valor acima de zero em um dos dois indicadores.
  - ação obrigatória: abrir hotfix focal no mesmo dia.

## Evidência e trilha
Cada execução gera pasta versionada em:
- `/opt/vinissimo/soi/backups/phase6_monitoring_<timestamp>/reports`

Artefatos mínimos:
- `commercial_integrity_report.txt`
- `summary.txt`
- `docker_compose_ps.txt`
- `ss_binds.txt`
- `public_login_headers.txt`
- `public_health.json`
- `public_port_443.txt`
- `public_port_3100.txt`
- `public_port_4100.txt`

## Cadência operacional recomendada
- diária no go-live assistido;
- após carga histórica/importação comercial;
- após deploy de backend que toque vendas/financeiro/clientes.

## Consequências
- reduz risco de CRM/financeiro divergirem da base operacional;
- padroniza gatilho de reação sem reabrir escopo de produto;
- mantém governança com trilha auditável por execução.
