# ADR-039 — Fase 7: operação assistida e governança contínua

## Contexto
Após o fechamento técnico das correções, era necessário garantir disciplina operacional contínua para prevenir regressões de integridade comercial e financeira.

## Objetivo da fase
1. Executar monitoramento recorrente com evidência versionada.
2. Definir regra objetiva de reação a alerta.
3. Consolidar leitura semanal da estabilidade operacional.

## Implementação
- Script diário de monitoramento (já ativo): `bin/phase6-monitoring-check.sh`.
- Script de consolidação gerencial da operação assistida: `bin/phase7-governance-report.sh`.
- Checklist diário operacional: `docs/checklists/OPERACAO-ASSISTIDA-DIARIA.md`.
- Agendamento em `cron` para rotina automática.

## Regra de reação
- Se `METRIC_MISMATCH_COUNT > 0` ou `DELIVERED_WITHOUT_RECEIVABLE > 0`:
  - classificar como `ALERTA`;
  - abrir hotfix focal no mesmo dia;
  - reexecutar monitoramento após correção.

## Evidência desta fase
- geração de relatório de governança com indicadores de execução;
- manutenção dos binds locais esperados para API/Web;
- domínio público preservado.

## Fora de escopo
- criação de novos módulos;
- alteração de regra de negócio já aprovada;
- automação externa de pagamento.
