# README_EXECUTION

## Ordem de execução
Siga estritamente T1 -> T10, sem pular gates.

## Comandos úteis
- Status stack: `cd /opt/vinissimo/soi && docker compose ps`
- Saúde API: `curl -sS https://app.vinissimoadega.com.br/api/v1/health`
- Ver binds: `ss -ltnp | egrep '(:3100|:4100|:443)'`
- Rodar migrações: `/opt/vinissimo/soi/scripts/migrate.sh`
- Rodar smoke tests: `/opt/vinissimo/soi/scripts/test/run-smoke.sh`

## Artefatos
- Evidências da execução ficam em `/opt/vinissimo/soi/backups`.

## Regra operacional
- Mudanças só em `/opt/vinissimo/soi`.
- Backup antes de qualquer remoção/alteração.
