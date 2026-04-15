#!/usr/bin/env bash
set -euo pipefail
cd /opt/vinissimo/soi
source ./.env

if [ "${1:-}" = "--file" ]; then
  shift
  FILE="${1:-}"
  [ -n "$FILE" ] || { echo "Uso: ./bin/psql.sh --file /caminho/arquivo.sql"; exit 1; }
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$FILE"
else
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
fi
