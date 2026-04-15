-- T8 — Revisão de queries e índices (Gate C)
-- Objetivo: reduzir full scans e custo de busca/filtros operacionais sem alterar semântica.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Busca textual de clientes (nome/telefone/e-mail/código)
CREATE INDEX IF NOT EXISTS ix_customers_full_name_trgm
  ON soi.customers USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_customers_email_trgm
  ON soi.customers USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_customers_phone_trgm
  ON soi.customers USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_customers_customer_code_trgm
  ON soi.customers USING gin (customer_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_customers_phone_digits
  ON soi.customers ((regexp_replace(COALESCE(phone, ''), '\D', '', 'g')));

-- Busca textual de produtos (cadastro mestre de vinhos + SKU)
CREATE INDEX IF NOT EXISTS ix_products_sku_trgm
  ON soi.products USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_products_name_trgm
  ON soi.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_products_country_name_trgm
  ON soi.products USING gin (country_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_products_region_name_trgm
  ON soi.products USING gin (region_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_products_grape_composition_trgm
  ON soi.products USING gin (grape_composition gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_products_wine_description_trgm
  ON soi.products USING gin (wine_description gin_trgm_ops);

-- Filtros operacionais de vendas/compras/estoque
CREATE INDEX IF NOT EXISTS ix_sales_orders_status_sale_date
  ON soi.sales_orders (order_status, sale_date DESC);

CREATE INDEX IF NOT EXISTS ix_sales_orders_channel_sale_date
  ON soi.sales_orders (channel_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS ix_sales_orders_customer_sale_date
  ON soi.sales_orders (customer_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier_purchase_date
  ON soi.purchase_orders (supplier_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_type_date
  ON soi.inventory_movements (movement_type, movement_date DESC);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_product_type_date
  ON soi.inventory_movements (product_id, movement_type, movement_date DESC);

CREATE INDEX IF NOT EXISTS ix_expenses_category_date
  ON soi.expenses (category, expense_date DESC);

-- Consultas de CRM (fila/memória) e métricas de cliente
CREATE INDEX IF NOT EXISTS ix_customer_metrics_customer_calculated_at
  ON soi.customer_metrics (customer_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS ix_customer_interactions_type_status_due
  ON soi.customer_interactions (interaction_type, interaction_status, scheduled_for);

CREATE INDEX IF NOT EXISTS ix_customer_interactions_customer_status_due
  ON soi.customer_interactions (customer_id, interaction_status, scheduled_for);

-- Consultas financeiras (overview/listagens/repasse)
CREATE INDEX IF NOT EXISTS ix_financial_receivables_status_expected
  ON soi.financial_receivables (status, expected_receipt_date, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_financial_receivables_settlement_batch
  ON soi.financial_receivables (settlement_batch_id, expected_receipt_date)
  WHERE settlement_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_financial_payables_status_due
  ON soi.financial_payables (status, due_date, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_financial_settlement_batches_channel_expected
  ON soi.financial_settlement_batches (channel_id, expected_receipt_date DESC);

COMMIT;
