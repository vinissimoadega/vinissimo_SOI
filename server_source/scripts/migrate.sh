#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="$ROOT_DIR/db/migration"

set -a
source "$ROOT_DIR/.env"
set +a

DB_CONTAINER="vinissimo-soi-db"
PSQL_BASE=(docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

run_sql() {
  local sql="$1"
  "${PSQL_BASE[@]}" -At -c "$sql"
}

run_file() {
  local file="$1"
  cat "$file" | "${PSQL_BASE[@]}"
}

run_sql "CREATE SCHEMA IF NOT EXISTS soi;"
run_sql "CREATE TABLE IF NOT EXISTS soi.schema_migrations (version TEXT PRIMARY KEY, description TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), execution_mode TEXT NOT NULL DEFAULT 'applied');"

mapfile -t files < <(find "$MIG_DIR" -maxdepth 1 -type f -name 'V*__*.sql' | sort)

for file in "${files[@]}"; do
  base="$(basename "$file")"
  version="${base%%__*}"
  description_raw="${base#*__}"
  description="${description_raw%.sql}"
  checksum="$(sha256sum "$file" | awk '{print $1}')"

  exists="$(run_sql "SELECT COUNT(1) FROM soi.schema_migrations WHERE version='${version}';")"
  if [[ "$exists" != "0" ]]; then
    echo "SKIP|$version|already_applied"
    continue
  fi

  if [[ "$version" == "V1" ]]; then
    users_exists="$(run_sql "SELECT CASE WHEN to_regclass('soi.users') IS NULL THEN 0 ELSE 1 END;")"
    if [[ "$users_exists" == "1" ]]; then
      run_sql "INSERT INTO soi.schema_migrations(version, description, checksum, execution_mode) VALUES ('${version}','${description}','${checksum}','baseline_skip');"
      echo "BASELINE_SKIP|$version|schema_already_present"
      continue
    fi
  fi

  run_file "$file"
  run_sql "INSERT INTO soi.schema_migrations(version, description, checksum, execution_mode) VALUES ('${version}','${description}','${checksum}','applied');"
  echo "APPLIED|$version|$base"
done

run_sql "SELECT version || '|' || execution_mode FROM soi.schema_migrations ORDER BY version;"
