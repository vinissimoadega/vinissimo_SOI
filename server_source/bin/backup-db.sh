#!/usr/bin/env bash
set -euo pipefail
cd /opt/vinissimo/soi
source ./.env
TS="$(date +%Y%m%d_%H%M%S)"
OUT="./backups/vinissimo_soi_${TS}.sql.gz"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$OUT"
echo "Backup salvo em: $OUT"
