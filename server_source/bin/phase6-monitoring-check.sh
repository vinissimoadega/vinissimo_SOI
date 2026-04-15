#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/vinissimo/soi"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT_DIR/backups/phase6_monitoring_${STAMP}"
REPORTS_DIR="$OUT_DIR/reports"
mkdir -p "$REPORTS_DIR"

COMMERCIAL_REPORT="$REPORTS_DIR/commercial_integrity_report.txt"
SUMMARY_REPORT="$REPORTS_DIR/summary.txt"

if [[ ! -x "$ROOT_DIR/bin/check-commercial-integrity.sh" ]]; then
  echo "ERRO: script obrigatorio ausente ou sem permissao: $ROOT_DIR/bin/check-commercial-integrity.sh" >&2
  exit 10
fi

"$ROOT_DIR/bin/check-commercial-integrity.sh" > "$COMMERCIAL_REPORT"

metric_mismatch_count="$(
  grep '^METRIC_MISMATCH_COUNT|' "$COMMERCIAL_REPORT" | tail -n1 | cut -d'|' -f2
)"
delivered_without_receivable="$(
  grep '^DELIVERED_WITHOUT_RECEIVABLE|' "$COMMERCIAL_REPORT" | tail -n1 | cut -d'|' -f2
)"
receivable_coverage="$(
  grep '^RECEIVABLE_COVERAGE|' "$COMMERCIAL_REPORT" | tail -n1 | cut -d'|' -f2-
)"

if [[ -z "${metric_mismatch_count}" || -z "${delivered_without_receivable}" ]]; then
  echo "ERRO: nao foi possivel extrair indicadores do relatorio comercial" >&2
  exit 11
fi

cd "$ROOT_DIR"
docker compose ps > "$REPORTS_DIR/docker_compose_ps.txt"
ss -ltnp | egrep '(:443|:3100|:4100)' > "$REPORTS_DIR/ss_binds.txt" || true
curl -sS -I https://app.vinissimoadega.com.br/login > "$REPORTS_DIR/public_login_headers.txt"
curl -sS https://app.vinissimoadega.com.br/api/v1/health > "$REPORTS_DIR/public_health.json"
nc -vz app.vinissimoadega.com.br 443 > "$REPORTS_DIR/public_port_443.txt" 2>&1
nc -vz app.vinissimoadega.com.br 3100 > "$REPORTS_DIR/public_port_3100.txt" 2>&1 || true
nc -vz app.vinissimoadega.com.br 4100 > "$REPORTS_DIR/public_port_4100.txt" 2>&1 || true

status="OK"
exit_code=0
if [[ "$metric_mismatch_count" -gt 0 || "$delivered_without_receivable" -gt 0 ]]; then
  status="ALERTA"
  exit_code=2
fi

cat > "$SUMMARY_REPORT" <<EOF
PHASE6_MONITORING_SUMMARY|$STAMP
STATUS|$status
METRIC_MISMATCH_COUNT|$metric_mismatch_count
DELIVERED_WITHOUT_RECEIVABLE|$delivered_without_receivable
RECEIVABLE_COVERAGE|$receivable_coverage
OUT_DIR|$OUT_DIR
ACTION_IF_ALERT|Abrir hotfix focal de sincronizacao comercial/financeira imediatamente.
EOF

cat "$SUMMARY_REPORT"
exit "$exit_code"
