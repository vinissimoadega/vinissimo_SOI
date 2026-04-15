-- =====================================================================
-- VINÍSSIMO — SOI
-- DDL Inicial em PostgreSQL
-- Versão: 1.0
-- Status: pronto para bootstrap do banco
-- Data-base: 2026-04-01
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Extensões e schema
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS soi;
SET search_path TO soi, public;

-- ---------------------------------------------------------------------
-- 1. Funções utilitárias
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION soi.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Tabelas de identidade e acesso
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower
    ON soi.users (LOWER(email));

CREATE TABLE IF NOT EXISTS soi.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key VARCHAR(50) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soi.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES soi.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES soi.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS soi.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NULL,
    action VARCHAR(80) NOT NULL,
    old_data JSONB NULL,
    new_data JSONB NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_entity
    ON soi.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS ix_audit_logs_occurred_at
    ON soi.audit_logs (occurred_at DESC);

-- ---------------------------------------------------------------------
-- 3. Referência e configuração
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_key VARCHAR(50) NOT NULL UNIQUE,
    channel_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soi.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code VARCHAR(40) NULL,
    name VARCHAR(180) NOT NULL,
    contact_name VARCHAR(120) NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(180) NULL,
    lead_time_days INTEGER NULL CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_supplier_code
    ON soi.suppliers (supplier_code)
    WHERE supplier_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_suppliers_name
    ON soi.suppliers (name);

CREATE TABLE IF NOT EXISTS soi.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soi.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    margin_min_target NUMERIC(8,4) NOT NULL CHECK (margin_min_target >= 0 AND margin_min_target < 1),
    replenishment_lead_time_days INTEGER NOT NULL CHECK (replenishment_lead_time_days >= 0),
    stock_safety_days INTEGER NOT NULL CHECK (stock_safety_days >= 0),
    customer_inactive_days INTEGER NOT NULL CHECK (customer_inactive_days >= 0),
    fee_whatsapp NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (fee_whatsapp >= 0 AND fee_whatsapp < 1),
    fee_instagram NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (fee_instagram >= 0 AND fee_instagram < 1),
    fee_ifood NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (fee_ifood >= 0 AND fee_ifood < 1),
    fee_counter NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (fee_counter >= 0 AND fee_counter < 1),
    fixed_monthly_expense_estimate NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (fixed_monthly_expense_estimate >= 0),
    avg_packaging_unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (avg_packaging_unit_cost >= 0),
    effective_from TIMESTAMPTZ NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_system_settings_current_true
    ON soi.system_settings (is_current)
    WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS soi.decision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    reason TEXT NULL,
    owner_user_id UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL,
    review_at TIMESTAMPTZ NULL,
    expected_impact TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_decision_logs_decision_date
    ON soi.decision_logs (decision_date DESC);

-- ---------------------------------------------------------------------
-- 4. Catálogo
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(60) NOT NULL,
    name VARCHAR(180) NOT NULL,
    category_id UUID NULL REFERENCES soi.product_categories(id) ON DELETE SET NULL,
    default_supplier_id UUID NULL REFERENCES soi.suppliers(id) ON DELETE SET NULL,
    country_name VARCHAR(100) NULL,
    region_name VARCHAR(140) NULL,
    grape_composition VARCHAR(240) NULL,
    wine_description TEXT NULL,
    base_unit_cost NUMERIC(14,2) NULL CHECK (base_unit_cost IS NULL OR base_unit_cost >= 0),
    initial_stock_qty NUMERIC(14,2) NOT NULL DEFAULT 0,
    min_stock_manual_qty NUMERIC(14,2) NULL CHECK (min_stock_manual_qty IS NULL OR min_stock_manual_qty >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku
    ON soi.products (sku);

CREATE INDEX IF NOT EXISTS ix_products_name
    ON soi.products (name);

CREATE INDEX IF NOT EXISTS ix_products_category_id
    ON soi.products (category_id);

CREATE TABLE IF NOT EXISTS soi.product_channel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES soi.channels(id) ON DELETE CASCADE,
    target_price NUMERIC(14,2) NOT NULL CHECK (target_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_channel_prices UNIQUE (product_id, channel_id)
);

CREATE TABLE IF NOT EXISTS soi.product_cost_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE CASCADE,
    current_unit_cost NUMERIC(14,2) NOT NULL CHECK (current_unit_cost >= 0),
    source_purchase_item_id UUID NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_cost_snapshots_product
    ON soi.product_cost_snapshots (product_id);

-- ---------------------------------------------------------------------
-- 5. Compras
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_number VARCHAR(40) NOT NULL UNIQUE,
    supplier_id UUID NULL REFERENCES soi.suppliers(id) ON DELETE SET NULL,
    purchase_date TIMESTAMPTZ NOT NULL,
    notes TEXT NULL,
    total_amount NUMERIC(14,2) NULL CHECK (total_amount IS NULL OR total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_purchase_orders_purchase_date
    ON soi.purchase_orders (purchase_date DESC);

CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier_id
    ON soi.purchase_orders (supplier_id);

CREATE TABLE IF NOT EXISTS soi.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES soi.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
    freight_allocated NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (freight_allocated >= 0),
    extra_cost_allocated NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (extra_cost_allocated >= 0),
    total_cost NUMERIC(14,2) NOT NULL CHECK (total_cost >= 0),
    real_unit_cost NUMERIC(14,2) NOT NULL CHECK (real_unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_purchase_order_items_product_id
    ON soi.purchase_order_items (product_id);

CREATE INDEX IF NOT EXISTS ix_purchase_order_items_purchase_order_id
    ON soi.purchase_order_items (purchase_order_id);

-- ---------------------------------------------------------------------
-- 6. Clientes e CRM
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(40) NULL,
    full_name VARCHAR(180) NOT NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(180) NULL,
    acquisition_channel_id UUID NULL REFERENCES soi.channels(id) ON DELETE SET NULL,
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_customer_code
    ON soi.customers (customer_code)
    WHERE customer_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_customers_phone
    ON soi.customers (phone);

CREATE INDEX IF NOT EXISTS ix_customers_full_name
    ON soi.customers (full_name);

CREATE TABLE IF NOT EXISTS soi.customer_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES soi.customers(id) ON DELETE CASCADE,
    preference_type VARCHAR(80) NOT NULL,
    preference_value TEXT NOT NULL,
    source VARCHAR(80) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_customer_preferences_customer_id
    ON soi.customer_preferences (customer_id);

CREATE TABLE IF NOT EXISTS soi.customer_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES soi.customers(id) ON DELETE CASCADE,
    first_purchase_at TIMESTAMPTZ NULL,
    last_purchase_at TIMESTAMPTZ NULL,
    orders_count INTEGER NOT NULL DEFAULT 0 CHECK (orders_count >= 0),
    total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
    avg_ticket NUMERIC(14,2) NULL CHECK (avg_ticket IS NULL OR avg_ticket >= 0),
    customer_status VARCHAR(30) NOT NULL CHECK (customer_status IN ('lead', 'novo', 'recorrente', 'inativo')),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_metrics_customer UNIQUE (customer_id)
);

CREATE INDEX IF NOT EXISTS ix_customer_metrics_customer_status
    ON soi.customer_metrics (customer_status);

CREATE TABLE IF NOT EXISTS soi.customer_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES soi.customers(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('post_sale', 'review_request', 'reactivation', 'other')),
    scheduled_for TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    owner_user_id UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_customer_interactions_customer_id
    ON soi.customer_interactions (customer_id);

-- ---------------------------------------------------------------------
-- 7. Vendas
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number VARCHAR(40) NOT NULL UNIQUE,
    sale_date TIMESTAMPTZ NOT NULL,
    customer_id UUID NULL REFERENCES soi.customers(id) ON DELETE SET NULL,
    channel_id UUID NOT NULL REFERENCES soi.channels(id) ON DELETE RESTRICT,
    order_status VARCHAR(30) NOT NULL CHECK (order_status IN ('pending', 'delivered', 'canceled')),
    gross_revenue NUMERIC(14,2) NULL CHECK (gross_revenue IS NULL OR gross_revenue >= 0),
    net_revenue NUMERIC(14,2) NULL CHECK (net_revenue IS NULL OR net_revenue >= 0),
    gross_profit NUMERIC(14,2) NULL,
    gross_margin_pct NUMERIC(8,4) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sales_orders_sale_date
    ON soi.sales_orders (sale_date DESC);

CREATE INDEX IF NOT EXISTS ix_sales_orders_channel_id
    ON soi.sales_orders (channel_id);

CREATE INDEX IF NOT EXISTS ix_sales_orders_customer_id
    ON soi.sales_orders (customer_id);

CREATE INDEX IF NOT EXISTS ix_sales_orders_status
    ON soi.sales_orders (order_status);

CREATE TABLE IF NOT EXISTS soi.sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES soi.sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    gross_revenue NUMERIC(14,2) NOT NULL CHECK (gross_revenue >= 0),
    channel_fee_pct NUMERIC(8,4) NOT NULL CHECK (channel_fee_pct >= 0 AND channel_fee_pct < 1),
    net_revenue NUMERIC(14,2) NOT NULL CHECK (net_revenue >= 0),
    cost_unit NUMERIC(14,2) NOT NULL CHECK (cost_unit >= 0),
    total_cost NUMERIC(14,2) NOT NULL CHECK (total_cost >= 0),
    gross_profit NUMERIC(14,2) NOT NULL,
    gross_margin_pct NUMERIC(8,4) NULL,
    below_min_price_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sales_order_items_sales_order_id
    ON soi.sales_order_items (sales_order_id);

CREATE INDEX IF NOT EXISTS ix_sales_order_items_product_id
    ON soi.sales_order_items (product_id);

CREATE TABLE IF NOT EXISTS soi.sales_order_additional_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID NOT NULL REFERENCES soi.sales_orders(id) ON DELETE CASCADE,
    cost_type VARCHAR(40) NOT NULL CHECK (
        cost_type IN (
            'custom_card',
            'special_packaging',
            'subsidized_shipping',
            'extra_delivery',
            'other'
        )
    ),
    description VARCHAR(160) NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_sales_order_additional_costs_order_id
    ON soi.sales_order_additional_costs (sales_order_id);

-- ---------------------------------------------------------------------
-- 8. Financeiro gerencial
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.financial_channel_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES soi.channels(id) ON DELETE CASCADE,
    settlement_type VARCHAR(40) NOT NULL CHECK (
        settlement_type IN ('immediate', 'deferred', 'marketplace_batch', 'manual')
    ),
    expected_settlement_rule VARCHAR(40) NOT NULL CHECK (
        expected_settlement_rule IN ('same_day', 'next_day', 'weekly_wednesday', 'days_after_sale', 'manual')
    ),
    expected_days INTEGER NULL CHECK (expected_days IS NULL OR expected_days >= 0),
    fee_pct NUMERIC(8,4) NULL CHECK (fee_pct IS NULL OR (fee_pct >= 0 AND fee_pct < 1)),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_financial_channel_rules_channel UNIQUE (channel_id)
);

CREATE TABLE IF NOT EXISTS soi.financial_settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_reference VARCHAR(40) NOT NULL UNIQUE,
    channel_id UUID NOT NULL REFERENCES soi.channels(id) ON DELETE RESTRICT,
    expected_settlement_rule VARCHAR(40) NOT NULL CHECK (
        expected_settlement_rule IN ('same_day', 'next_day', 'weekly_wednesday', 'days_after_sale', 'manual')
    ),
    competency_start DATE NOT NULL,
    competency_end DATE NOT NULL,
    expected_receipt_date DATE NOT NULL,
    actual_receipt_date TIMESTAMPTZ NULL,
    expected_amount NUMERIC(14,2) NOT NULL CHECK (expected_amount >= 0),
    received_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('previsto', 'recebido', 'recebido_parcial', 'divergente', 'cancelado')
    ),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_financial_settlement_batches_expected
    ON soi.financial_settlement_batches (expected_receipt_date);

CREATE TABLE IF NOT EXISTS soi.financial_receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_number VARCHAR(40) NOT NULL UNIQUE,
    source_type VARCHAR(40) NOT NULL CHECK (
        source_type IN ('sale', 'manual_revenue', 'settlement_batch')
    ),
    source_id UUID NULL,
    sales_order_id UUID NULL REFERENCES soi.sales_orders(id) ON DELETE SET NULL,
    settlement_batch_id UUID NULL REFERENCES soi.financial_settlement_batches(id) ON DELETE SET NULL,
    channel_id UUID NULL REFERENCES soi.channels(id) ON DELETE SET NULL,
    customer_id UUID NULL REFERENCES soi.customers(id) ON DELETE SET NULL,
    counterparty_name VARCHAR(180) NULL,
    gross_amount NUMERIC(14,2) NOT NULL CHECK (gross_amount >= 0),
    net_expected_amount NUMERIC(14,2) NOT NULL CHECK (net_expected_amount >= 0),
    competency_date TIMESTAMPTZ NOT NULL,
    expected_receipt_date DATE NOT NULL,
    actual_receipt_date TIMESTAMPTZ NULL,
    amount_received NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('previsto', 'vencendo_hoje', 'vencido', 'recebido', 'recebido_parcial', 'cancelado')
    ),
    is_expected_date_manual BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_receivables_sale
    ON soi.financial_receivables (sales_order_id)
    WHERE sales_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_financial_receivables_expected
    ON soi.financial_receivables (expected_receipt_date, status);

CREATE INDEX IF NOT EXISTS ix_financial_receivables_channel
    ON soi.financial_receivables (channel_id, expected_receipt_date);

CREATE TABLE IF NOT EXISTS soi.financial_payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payable_number VARCHAR(40) NOT NULL UNIQUE,
    source_type VARCHAR(40) NOT NULL CHECK (
        source_type IN ('purchase', 'expense', 'manual')
    ),
    source_id UUID NULL,
    purchase_order_id UUID NULL REFERENCES soi.purchase_orders(id) ON DELETE SET NULL,
    expense_id UUID NULL REFERENCES soi.expenses(id) ON DELETE SET NULL,
    supplier_id UUID NULL REFERENCES soi.suppliers(id) ON DELETE SET NULL,
    counterparty_name VARCHAR(180) NULL,
    category VARCHAR(100) NULL,
    cost_nature VARCHAR(30) NULL CHECK (
        cost_nature IS NULL OR cost_nature IN ('fixed', 'variable')
    ),
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    competency_date TIMESTAMPTZ NOT NULL,
    due_date DATE NOT NULL,
    actual_payment_date TIMESTAMPTZ NULL,
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    payment_method VARCHAR(40) NULL,
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('previsto', 'vencendo_hoje', 'vencido', 'pago', 'pago_parcial', 'cancelado')
    ),
    is_due_date_manual BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_payables_purchase
    ON soi.financial_payables (purchase_order_id)
    WHERE purchase_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_payables_expense
    ON soi.financial_payables (expense_id)
    WHERE expense_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_financial_payables_due
    ON soi.financial_payables (due_date, status);

CREATE INDEX IF NOT EXISTS ix_financial_payables_supplier
    ON soi.financial_payables (supplier_id, due_date);

-- ---------------------------------------------------------------------
-- 9. Estoque
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(40) NOT NULL CHECK (
        movement_type IN (
            'initial_stock',
            'purchase_in',
            'sale_out',
            'adjustment',
            'cancel_reversal',
            'return_in'
        )
    ),
    movement_date TIMESTAMPTZ NOT NULL,
    quantity_delta NUMERIC(14,2) NOT NULL,
    unit_cost_reference NUMERIC(14,2) NULL CHECK (unit_cost_reference IS NULL OR unit_cost_reference >= 0),
    source_type VARCHAR(60) NULL,
    source_id UUID NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_product_date
    ON soi.inventory_movements (product_id, movement_date DESC);

CREATE TABLE IF NOT EXISTS soi.inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE CASCADE,
    current_stock_qty NUMERIC(14,2) NOT NULL,
    accumulated_sales_qty NUMERIC(14,2) NOT NULL DEFAULT 0,
    avg_daily_sales_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
    suggested_min_stock_qty NUMERIC(14,2) NOT NULL DEFAULT 0,
    used_min_stock_qty NUMERIC(14,2) NOT NULL DEFAULT 0,
    coverage_days NUMERIC(14,4) NULL,
    stock_status VARCHAR(30) NOT NULL CHECK (stock_status IN ('ruptura', 'repor_agora', 'atencao', 'ok')),
    suggested_purchase_qty NUMERIC(14,2) NOT NULL DEFAULT 0,
    tied_up_capital NUMERIC(14,2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_snapshots_product UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS soi.product_channel_min_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES soi.channels(id) ON DELETE CASCADE,
    min_price NUMERIC(14,2) NOT NULL CHECK (min_price >= 0),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_channel_min_prices UNIQUE (product_id, channel_id)
);

-- ---------------------------------------------------------------------
-- 10. Despesas, alertas e snapshots executivos
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date TIMESTAMPTZ NOT NULL,
    expense_type VARCHAR(80) NOT NULL,
    category VARCHAR(80) NULL,
    description TEXT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    channel_id UUID NULL REFERENCES soi.channels(id) ON DELETE SET NULL,
    cost_nature VARCHAR(30) NOT NULL CHECK (cost_nature IN ('fixed', 'variable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_expenses_expense_date
    ON soi.expenses (expense_date DESC);

CREATE INDEX IF NOT EXISTS ix_expenses_channel_id
    ON soi.expenses (channel_id);

CREATE TABLE IF NOT EXISTS soi.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(60) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ NULL,
    resolved_at TIMESTAMPTZ NULL,
    owner_user_id UUID NULL REFERENCES soi.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_alerts_status
    ON soi.alerts (status);

CREATE INDEX IF NOT EXISTS ix_alerts_severity
    ON soi.alerts (severity);

CREATE INDEX IF NOT EXISTS ix_alerts_entity
    ON soi.alerts (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS soi.dashboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_date DATE NOT NULL,
    gross_revenue_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_revenue_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    gross_profit_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    expenses_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    estimated_net_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
    avg_ticket NUMERIC(14,2) NULL,
    new_customers_count INTEGER NOT NULL DEFAULT 0,
    recurring_customers_count INTEGER NOT NULL DEFAULT 0,
    inactive_customers_count INTEGER NOT NULL DEFAULT 0,
    rupture_skus_count INTEGER NOT NULL DEFAULT 0,
    replenish_now_skus_count INTEGER NOT NULL DEFAULT 0,
    tied_up_capital_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dashboard_snapshots_reference_date
    ON soi.dashboard_snapshots (reference_date);

-- ---------------------------------------------------------------------
-- 11. Tabelas futuras de inteligência
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS soi.demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE CASCADE,
    channel_id UUID NULL REFERENCES soi.channels(id) ON DELETE SET NULL,
    forecast_date DATE NOT NULL,
    forecast_horizon VARCHAR(30) NOT NULL,
    forecast_qty NUMERIC(14,4) NOT NULL,
    confidence_score NUMERIC(8,4) NULL,
    model_version VARCHAR(80) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soi.replenishment_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES soi.products(id) ON DELETE CASCADE,
    recommendation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suggested_qty NUMERIC(14,2) NOT NULL,
    justification TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soi.customer_reactivation_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES soi.customers(id) ON DELETE CASCADE,
    recommendation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NULL,
    priority_score NUMERIC(8,4) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS soi.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(80) NOT NULL,
    reference_scope VARCHAR(80) NULL,
    reference_id UUID NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    priority_score NUMERIC(8,4) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 12. Triggers de updated_at
-- ---------------------------------------------------------------------

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON soi.users
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_suppliers_set_updated_at
BEFORE UPDATE ON soi.suppliers
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON soi.products
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_product_channel_prices_set_updated_at
BEFORE UPDATE ON soi.product_channel_prices
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_customers_set_updated_at
BEFORE UPDATE ON soi.customers
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_sales_orders_set_updated_at
BEFORE UPDATE ON soi.sales_orders
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_financial_channel_rules_set_updated_at
BEFORE UPDATE ON soi.financial_channel_rules
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_financial_receivables_set_updated_at
BEFORE UPDATE ON soi.financial_receivables
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_financial_payables_set_updated_at
BEFORE UPDATE ON soi.financial_payables
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

CREATE TRIGGER trg_financial_settlement_batches_set_updated_at
BEFORE UPDATE ON soi.financial_settlement_batches
FOR EACH ROW EXECUTE FUNCTION soi.set_updated_at();

-- ---------------------------------------------------------------------
-- 13. Views operacionais
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW soi.v_current_system_settings AS
SELECT *
FROM soi.system_settings
WHERE is_current = TRUE
ORDER BY effective_from DESC
LIMIT 1;

CREATE OR REPLACE VIEW soi.v_product_current_unit_cost AS
SELECT
    p.id AS product_id,
    p.sku,
    p.name,
    COALESCE(pcs.current_unit_cost, p.base_unit_cost, 0) AS current_unit_cost,
    pcs.calculated_at
FROM soi.products p
LEFT JOIN soi.product_cost_snapshots pcs
    ON pcs.product_id = p.id;

CREATE OR REPLACE VIEW soi.v_inventory_balance AS
SELECT
    p.id AS product_id,
    p.sku,
    p.name,
    p.initial_stock_qty,
    COALESCE(SUM(im.quantity_delta), 0) AS movements_balance_qty,
    p.initial_stock_qty + COALESCE(SUM(im.quantity_delta), 0) AS current_stock_qty
FROM soi.products p
LEFT JOIN soi.inventory_movements im
    ON im.product_id = p.id
GROUP BY p.id, p.sku, p.name, p.initial_stock_qty;

CREATE OR REPLACE VIEW soi.v_customer_status AS
SELECT
    c.id AS customer_id,
    c.customer_code,
    c.full_name,
    c.phone,
    MIN(CASE WHEN so.order_status = 'delivered' THEN so.sale_date END) AS first_purchase_at,
    MAX(CASE WHEN so.order_status = 'delivered' THEN so.sale_date END) AS last_purchase_at,
    COUNT(CASE WHEN so.order_status = 'delivered' THEN 1 END) AS orders_count,
    COALESCE(SUM(CASE WHEN so.order_status = 'delivered' THEN so.net_revenue ELSE 0 END), 0) AS total_revenue,
    CASE
        WHEN COUNT(CASE WHEN so.order_status = 'delivered' THEN 1 END) = 0 THEN NULL
        ELSE COALESCE(SUM(CASE WHEN so.order_status = 'delivered' THEN so.net_revenue ELSE 0 END), 0)
             / COUNT(CASE WHEN so.order_status = 'delivered' THEN 1 END)
    END AS avg_ticket,
    CASE
        WHEN COUNT(CASE WHEN so.order_status = 'delivered' THEN 1 END) = 0 THEN 'lead'
        WHEN COUNT(CASE WHEN so.order_status = 'delivered' THEN 1 END) = 1 THEN 'novo'
        WHEN MAX(CASE WHEN so.order_status = 'delivered' THEN so.sale_date END) <
             NOW() - make_interval(days => (SELECT customer_inactive_days FROM soi.v_current_system_settings))
            THEN 'inativo'
        ELSE 'recorrente'
    END AS customer_status
FROM soi.customers c
LEFT JOIN soi.sales_orders so
    ON so.customer_id = c.id
GROUP BY c.id, c.customer_code, c.full_name, c.phone;

CREATE OR REPLACE VIEW soi.v_channel_performance AS
SELECT
    ch.id AS channel_id,
    ch.channel_key,
    ch.channel_name,
    COUNT(DISTINCT so.id) FILTER (WHERE so.order_status = 'delivered') AS delivered_orders_count,
    COALESCE(SUM(so.net_revenue) FILTER (WHERE so.order_status = 'delivered'), 0) AS net_revenue_total,
    COALESCE(SUM(so.gross_profit) FILTER (WHERE so.order_status = 'delivered'), 0) AS gross_profit_total,
    CASE
        WHEN COUNT(DISTINCT so.id) FILTER (WHERE so.order_status = 'delivered') = 0 THEN NULL
        ELSE COALESCE(SUM(so.net_revenue) FILTER (WHERE so.order_status = 'delivered'), 0)
             / COUNT(DISTINCT so.id) FILTER (WHERE so.order_status = 'delivered')
    END AS avg_ticket,
    CASE
        WHEN COALESCE(SUM(so.net_revenue) FILTER (WHERE so.order_status = 'delivered'), 0) = 0 THEN NULL
        ELSE COALESCE(SUM(so.gross_profit) FILTER (WHERE so.order_status = 'delivered'), 0)
             / COALESCE(SUM(so.net_revenue) FILTER (WHERE so.order_status = 'delivered'), 0)
    END AS gross_margin_pct
FROM soi.channels ch
LEFT JOIN soi.sales_orders so
    ON so.channel_id = ch.id
GROUP BY ch.id, ch.channel_key, ch.channel_name;

CREATE OR REPLACE VIEW soi.v_product_stock_status AS
SELECT
    p.id AS product_id,
    p.sku,
    p.name,
    pc.name AS category_name,
    vb.current_stock_qty,
    COALESCE(p.min_stock_manual_qty, 0) AS manual_min_stock_qty,
    COALESCE(ics.avg_daily_sales_qty, 0) AS avg_daily_sales_qty,
    COALESCE(ss.replenishment_lead_time_days, 0) AS replenishment_lead_time_days,
    COALESCE(ss.stock_safety_days, 0) AS stock_safety_days,
    (COALESCE(ics.avg_daily_sales_qty, 0) * (COALESCE(ss.replenishment_lead_time_days, 0) + COALESCE(ss.stock_safety_days, 0)))::NUMERIC(14,2) AS suggested_min_stock_qty,
    GREATEST(
        COALESCE(p.min_stock_manual_qty, 0),
        (COALESCE(ics.avg_daily_sales_qty, 0) * (COALESCE(ss.replenishment_lead_time_days, 0) + COALESCE(ss.stock_safety_days, 0)))::NUMERIC(14,2)
    ) AS used_min_stock_qty,
    CASE
        WHEN COALESCE(ics.avg_daily_sales_qty, 0) = 0 THEN NULL
        ELSE vb.current_stock_qty / ics.avg_daily_sales_qty
    END AS coverage_days,
    CASE
        WHEN vb.current_stock_qty <= 0 THEN 'ruptura'
        WHEN vb.current_stock_qty <= GREATEST(
            COALESCE(p.min_stock_manual_qty, 0),
            (COALESCE(ics.avg_daily_sales_qty, 0) * (COALESCE(ss.replenishment_lead_time_days, 0) + COALESCE(ss.stock_safety_days, 0)))::NUMERIC(14,2)
        ) THEN 'repor_agora'
        WHEN COALESCE(ics.avg_daily_sales_qty, 0) > 0
             AND (vb.current_stock_qty / ics.avg_daily_sales_qty) <= 7 THEN 'atencao'
        ELSE 'ok'
    END AS stock_status,
    GREATEST(
        0,
        GREATEST(
            COALESCE(p.min_stock_manual_qty, 0),
            (COALESCE(ics.avg_daily_sales_qty, 0) * (COALESCE(ss.replenishment_lead_time_days, 0) + COALESCE(ss.stock_safety_days, 0)))::NUMERIC(14,2)
        ) - vb.current_stock_qty
    ) AS suggested_purchase_qty,
    vb.current_stock_qty * COALESCE(pcu.current_unit_cost, 0) AS tied_up_capital
FROM soi.products p
LEFT JOIN soi.product_categories pc
    ON pc.id = p.category_id
LEFT JOIN soi.v_inventory_balance vb
    ON vb.product_id = p.id
LEFT JOIN (
    SELECT
        soi_item.product_id,
        COALESCE(SUM(soi_item.quantity) FILTER (
            WHERE so.sale_date >= NOW() - INTERVAL '30 days'
              AND so.order_status = 'delivered'
        ), 0) / 30.0 AS avg_daily_sales_qty
    FROM soi.sales_order_items soi_item
    JOIN soi.sales_orders so
        ON so.id = soi_item.sales_order_id
    GROUP BY soi_item.product_id
) ics
    ON ics.product_id = p.id
CROSS JOIN soi.v_current_system_settings ss
LEFT JOIN soi.v_product_current_unit_cost pcu
    ON pcu.product_id = p.id;

-- ---------------------------------------------------------------------
-- 13. Seeds mínimos
-- ---------------------------------------------------------------------

INSERT INTO soi.roles (role_key, role_name)
VALUES
    ('admin', 'Admin / Direção'),
    ('operacao', 'Operação'),
    ('comercial', 'Comercial'),
    ('crm', 'CRM / Relacionamento'),
    ('financeiro', 'Financeiro')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO soi.channels (channel_key, channel_name)
VALUES
    ('whatsapp', 'WhatsApp'),
    ('instagram', 'Instagram'),
    ('ifood', 'iFood'),
    ('balcao', 'Balcão')
ON CONFLICT (channel_key) DO NOTHING;

COMMIT;

-- =====================================================================
-- Fim do DDL inicial
-- =====================================================================
