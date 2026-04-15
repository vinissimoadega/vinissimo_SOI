#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/vinissimo/soi
TS=$(date +%Y%m%d_%H%M%S)
OUT="$ROOT/backups/smoke_run_${TS}"
mkdir -p "$OUT"

pass=0
fail=0

run_check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" > "$OUT/${name}.out" 2> "$OUT/${name}.err"; then
    echo "PASS|$name" | tee -a "$OUT/summary.txt"
    pass=$((pass+1))
  else
    echo "FAIL|$name" | tee -a "$OUT/summary.txt"
    fail=$((fail+1))
  fi
}

run_check docker_compose_ps "cd $ROOT && docker compose ps"
run_check api_health "curl -fsS https://app.vinissimoadega.com.br/api/v1/health | grep -q '\"status\":\"ok\"'"
run_check public_login "curl -fsSI https://app.vinissimoadega.com.br/login | grep -q 'HTTP/2 200'"
run_check dashboard_requires_auth "curl -fsSI https://app.vinissimoadega.com.br/dashboard | egrep -q 'HTTP/2 30[1278]|location: /login'"
run_check crm_requires_auth "curl -fsSI https://app.vinissimoadega.com.br/crm | egrep -q 'HTTP/2 30[1278]|location: /login'"
run_check local_binds "ss -ltnp | egrep -q '127.0.0.1:3100|127.0.0.1:4100'"

{
  echo "TOTAL_PASS|$pass"
  echo "TOTAL_FAIL|$fail"
  echo "OUT_DIR|$OUT"
} | tee -a "$OUT/summary.txt"

if [ "$fail" -gt 0 ]; then
  exit 1
fi
