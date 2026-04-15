#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/vinissimo/soi"
cd "$ROOT_DIR"

set -a
source ./.env
set +a

STAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR="$ROOT_DIR/backups/commercial_integrity_audit_${STAMP}"
mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/report.txt"

{
  echo "COMMERCIAL_INTEGRITY_AUDIT|$STAMP"
  echo "HOST|$(hostname)"
  echo "PROJECT|vinissimo-soi"
} > "$REPORT"

docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" vinissimo-soi-db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At <<'SQL' >> "$REPORT"
WITH delivered AS (
  SELECT so.customer_id,
         MIN(so.sale_date)::date AS first_purchase_at,
         MAX(so.sale_date)::date AS last_purchase_at,
         COUNT(*)::int AS orders_count,
         COALESCE(SUM(COALESCE(so.net_revenue,0)),0)::numeric(14,2) AS total_revenue
  FROM soi.sales_orders so
  WHERE so.customer_id IS NOT NULL
    AND so.order_status = 'delivered'
  GROUP BY so.customer_id
), joined AS (
  SELECT c.id,
         c.customer_code,
         c.full_name,
         d.first_purchase_at AS derived_first_purchase_at,
         d.last_purchase_at AS derived_last_purchase_at,
         d.orders_count AS derived_orders_count,
         d.total_revenue AS derived_total_revenue,
         cm.first_purchase_at::date AS metric_first_purchase_at,
         cm.last_purchase_at::date AS metric_last_purchase_at,
         COALESCE(cm.orders_count,0) AS metric_orders_count,
         COALESCE(cm.total_revenue,0)::numeric(14,2) AS metric_total_revenue
  FROM soi.customers c
  LEFT JOIN delivered d ON d.customer_id = c.id
  LEFT JOIN soi.customer_metrics cm ON cm.customer_id = c.id
)
SELECT 'METRIC_MISMATCH_COUNT|' || COUNT(*)
FROM joined
WHERE COALESCE(derived_orders_count,0) <> COALESCE(metric_orders_count,0)
   OR COALESCE(derived_total_revenue,0) <> COALESCE(metric_total_revenue,0)
   OR COALESCE(derived_first_purchase_at::text,'') <> COALESCE(metric_first_purchase_at::text,'')
   OR COALESCE(derived_last_purchase_at::text,'') <> COALESCE(metric_last_purchase_at::text,'');

SELECT 'DELIVERED_WITHOUT_RECEIVABLE|' || COUNT(*)
FROM soi.sales_orders so
LEFT JOIN soi.financial_receivables fr ON fr.sales_order_id = so.id
WHERE so.order_status = 'delivered'
  AND fr.id IS NULL;

SELECT 'RECEIVABLE_COVERAGE|' ||
       (SELECT COUNT(*) FROM soi.sales_orders WHERE order_status='delivered') || '|' ||
       (SELECT COUNT(DISTINCT sales_order_id) FROM soi.financial_receivables WHERE sales_order_id IS NOT NULL);
SQL

echo "REPORT_PATH|$REPORT" >> "$REPORT"
cat "$REPORT"
