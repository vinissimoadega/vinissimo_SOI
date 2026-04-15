#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/vinissimo/soi"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT_DIR/backups/phase7_governance_report_${STAMP}"
REPORT="$OUT_DIR/governance_report.txt"
mkdir -p "$OUT_DIR"

start_date="${1:-$(date -d '7 days ago' +%Y-%m-%d)}"
end_date="${2:-$(date +%Y-%m-%d)}"

summaries=("$ROOT_DIR"/backups/phase6_monitoring_*/reports/summary.txt)
commercials=("$ROOT_DIR"/backups/phase6_monitoring_*/reports/commercial_integrity_report.txt)

summary_exists=0
if ls "$ROOT_DIR"/backups/phase6_monitoring_*/reports/summary.txt >/dev/null 2>&1; then
  summary_exists=1
fi

if [[ "$summary_exists" -eq 1 ]]; then
  total_runs=$(find "$ROOT_DIR/backups" -maxdepth 1 -type d -name 'phase6_monitoring_*' | wc -l)
  ok_runs=$(grep -R '^STATUS|OK' "$ROOT_DIR"/backups/phase6_monitoring_*/reports/summary.txt 2>/dev/null | wc -l || true)
  alert_runs=$(grep -R '^STATUS|ALERTA' "$ROOT_DIR"/backups/phase6_monitoring_*/reports/summary.txt 2>/dev/null | wc -l || true)
  latest_summary=$(ls -1dt "$ROOT_DIR"/backups/phase6_monitoring_*/reports/summary.txt 2>/dev/null | head -n1 || true)
  latest_commercial=$(ls -1dt "$ROOT_DIR"/backups/phase6_monitoring_*/reports/commercial_integrity_report.txt 2>/dev/null | head -n1 || true)
else
  total_runs=0
  ok_runs=0
  alert_runs=0
  latest_summary=""
  latest_commercial=""
fi

cd "$ROOT_DIR"
set -a
source ./.env
set +a

sales_delivered=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" vinissimo-soi-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT COUNT(*) FROM soi.sales_orders WHERE order_status='delivered';")
receivables_for_sales=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" vinissimo-soi-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT COUNT(DISTINCT sales_order_id) FROM soi.financial_receivables WHERE sales_order_id IS NOT NULL;")

{
  echo "PHASE7_GOVERNANCE_REPORT|$STAMP"
  echo "PERIOD|$start_date|$end_date"
  echo "TOTAL_MONITORING_RUNS|$total_runs"
  echo "STATUS_OK_RUNS|$ok_runs"
  echo "STATUS_ALERT_RUNS|$alert_runs"
  echo "SALES_DELIVERED|$sales_delivered"
  echo "RECEIVABLES_LINKED_TO_SALES|$receivables_for_sales"
  if [ -n "$latest_summary" ]; then
    echo "LATEST_SUMMARY_PATH|$latest_summary"
    echo "LATEST_SUMMARY_CONTENT_START"
    cat "$latest_summary"
    echo "LATEST_SUMMARY_CONTENT_END"
  else
    echo "LATEST_SUMMARY_PATH|"
  fi
  if [ -n "$latest_commercial" ]; then
    echo "LATEST_COMMERCIAL_PATH|$latest_commercial"
  else
    echo "LATEST_COMMERCIAL_PATH|"
  fi
  echo "ACTION_RULE|Se STATUS_ALERT_RUNS > 0, abrir hotfix focal no mesmo dia."
} > "$REPORT"

cat "$REPORT"
