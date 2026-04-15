#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/vinissimo/soi
TS=$(date +%Y%m%d_%H%M%S)
OUT="$ROOT/backups/critical_run_${TS}"
mkdir -p "$OUT"
COOKIE_JAR="$OUT/cookies.txt"

set -a
source "$ROOT/.env"
set +a

DB_EXEC=(docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" vinissimo-soi-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1)

TEST_EMAIL="soi.test.runner@vinissimo.local"
TEST_PASS="T7Runner!2026"
TEST_NAME="SOI Test Runner"

PASS=0
FAIL=0

record() {
  local status="$1"
  local name="$2"
  echo "$status|$name" | tee -a "$OUT/summary.txt"
}

check() {
  local name="$1"
  shift
  if "$@" > "$OUT/${name}.out" 2> "$OUT/${name}.err"; then
    record PASS "$name"
    PASS=$((PASS+1))
  else
    record FAIL "$name"
    FAIL=$((FAIL+1))
  fi
}

check_json_endpoint() {
  local name="$1"
  local url="$2"
  local key_regex="$3"
  local body_file="$OUT/${name}.json"
  local code
  code=$(curl -sS -o "$body_file" -w "%{http_code}" -b "$COOKIE_JAR" "$url")
  if [[ "$code" == "200" ]] && grep -Eq "$key_regex" "$body_file"; then
    record PASS "$name"
    PASS=$((PASS+1))
  else
    echo "HTTP_CODE=$code" > "$OUT/${name}.err"
    record FAIL "$name"
    FAIL=$((FAIL+1))
  fi
}

# Deterministic test user with admin role
hash=$(TEST_PASS_ENV="$TEST_PASS" python3 - <<'PY'
import os
import secrets
import hashlib
pw = os.environ["TEST_PASS_ENV"].encode()
salt = secrets.token_hex(16)
key = hashlib.scrypt(pw, salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
print(f"scrypt${salt}${key}".replace("$", "$", 1).replace("$", "$", 1))
PY
)
# fallback safe format (python string above may be altered by shell quirks)
if [[ "$hash" != scrypt\$*\$* ]]; then
  hash=$(TEST_PASS_ENV="$TEST_PASS" python3 - <<'PY'
import os, secrets, hashlib
pw = os.environ["TEST_PASS_ENV"].encode()
salt = secrets.token_hex(16)
key = hashlib.scrypt(pw, salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
print("scrypt$" + salt + "$" + key)
PY
)
fi

"${DB_EXEC[@]}" -c "INSERT INTO soi.users (full_name,email,password_hash,is_active) VALUES ('${TEST_NAME}','${TEST_EMAIL}','${hash}',true) ON CONFLICT DO NOTHING;" >/dev/null
"${DB_EXEC[@]}" -c "INSERT INTO soi.user_roles (user_id, role_id) SELECT u.id, r.id FROM soi.users u JOIN soi.roles r ON r.role_key='admin' WHERE lower(u.email)=lower('${TEST_EMAIL}') ON CONFLICT (user_id, role_id) DO NOTHING;" >/dev/null

check docker_compose_ps bash -lc "cd $ROOT && docker compose ps"

login_body="$OUT/login_body.json"
login_headers="$OUT/login_headers.txt"
http_code=$(curl -sS -o "$login_body" -D "$login_headers" -c "$COOKIE_JAR" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -X POST https://app.vinissimoadega.com.br/api/v1/auth/login \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}")

if [[ "$http_code" =~ ^20(0|1)$ ]] && grep -qi "vinissimo_soi_session" "$login_headers"; then
  record PASS auth_login_success
  PASS=$((PASS+1))
else
  record FAIL auth_login_success
  FAIL=$((FAIL+1))
fi

check auth_me bash -lc "curl -sS -b $COOKIE_JAR https://app.vinissimoadega.com.br/api/v1/auth/me | grep -q '${TEST_EMAIL}'"
check_json_endpoint customers_list "https://app.vinissimoadega.com.br/api/v1/customers?page=1&pageSize=5" "\"items\"|\"data\""
check_json_endpoint sales_list "https://app.vinissimoadega.com.br/api/v1/sales?page=1&pageSize=5" "\"items\"|\"data\""
check_json_endpoint inventory_status "https://app.vinissimoadega.com.br/api/v1/inventory/status?page=1&pageSize=5" "\"items\"|\"data\""
check_json_endpoint financial_overview "https://app.vinissimoadega.com.br/api/v1/financial/overview" "\"cards\"|\"cashflowSummary7Days\"|\"pnlSummary\""
check_json_endpoint dashboard_overview "https://app.vinissimoadega.com.br/api/v1/dashboard/overview" "\"executiveSummary\"|\"stockSummary\"|\"channelSummary\""
check_json_endpoint crm_overview "https://app.vinissimoadega.com.br/api/v1/crm/overview" "\"queueSummary\"|\"queue\"|\"tasks\""

product_line=$("${DB_EXEC[@]}" -c "WITH movement_totals AS (SELECT product_id, COALESCE(SUM(quantity_delta),0)::numeric AS net_quantity FROM soi.inventory_movements GROUP BY product_id) SELECT p.id || '|' || ((COALESCE(p.initial_stock_qty,0)+COALESCE(mt.net_quantity,0))::numeric)::text FROM soi.products p LEFT JOIN movement_totals mt ON mt.product_id=p.id ORDER BY p.name ASC LIMIT 1;")
prod_id="${product_line%%|*}"
prod_stock="${product_line#*|}"
adj_body="$OUT/inventory_adjust_noop_body.json"
adj_headers="$OUT/inventory_adjust_noop_headers.txt"
adj_code=$(curl -sS -o "$adj_body" -D "$adj_headers" -b "$COOKIE_JAR" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -X POST https://app.vinissimoadega.com.br/api/v1/inventory/movements \
  -d "{\"productId\":\"${prod_id}\",\"movementDate\":\"$(date -u +%Y-%m-%dT12:00:00Z)\",\"adjustmentMode\":\"target_balance\",\"targetStockQty\":\"${prod_stock}\",\"notes\":\"Teste no-op T7\"}")

if [[ "$adj_code" == "400" ]] && grep -q "não altera o estoque" "$adj_body"; then
  record PASS inventory_noop_rule
  PASS=$((PASS+1))
else
  record FAIL inventory_noop_rule
  FAIL=$((FAIL+1))
fi

{
  echo "TOTAL_PASS|$PASS"
  echo "TOTAL_FAIL|$FAIL"
  echo "OUT_DIR|$OUT"
} | tee -a "$OUT/summary.txt"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
