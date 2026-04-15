# Checklist diário — Operação assistida

## Abertura
- Confirmar acesso em `https://app.vinissimoadega.com.br/login`.
- Confirmar saúde em `https://app.vinissimoadega.com.br/api/v1/health`.
- Executar `bin/phase6-monitoring-check.sh`.
- Validar `STATUS|OK` no resumo.

## Durante o dia
- Registrar vendas e clientes no fluxo oficial.
- Evitar lançamentos fora do fluxo.
- Corrigir pendências no mesmo turno.

## Fechamento
- Executar `bin/phase7-governance-report.sh` quando houver carga/importação.
- Se houver `STATUS|ALERTA`, abrir hotfix focal ainda no dia.
- Arquivar evidências em `/opt/vinissimo/soi/backups`.
