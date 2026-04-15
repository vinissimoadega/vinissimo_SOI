import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DASHBOARD_PENDING_BASE_ITEMS } from './dashboard.pending';
import {
  DashboardAlert,
  DashboardBaseCoverage,
  DashboardChannelSummary,
  DashboardCustomerStatus,
  DashboardCustomerSummary,
  DashboardExecutiveSummary,
  DashboardOverviewResponse,
  DashboardStockAlertItem,
  DashboardStockSummary,
} from './dashboard.types';

type ExecutiveSummaryRow = QueryResultRow & DashboardExecutiveSummary;
type StockSummaryRow = QueryResultRow & DashboardStockSummary;
type ChannelSummaryRow = QueryResultRow & DashboardChannelSummary;
type CustomerSummaryRow = QueryResultRow & {
  customerStatus: DashboardCustomerStatus;
  total: number;
};
type StockAlertRow = QueryResultRow & DashboardStockAlertItem;
type BaseCoverageRow = QueryResultRow & {
  realProducts: string;
  productsWithCost: string;
  productsWithoutCost: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getOverview(): Promise<DashboardOverviewResponse> {
    const [
      executiveSummary,
      stockSummary,
      channelSummary,
      customerSummaryRows,
      criticalStock,
      baseCoverage,
    ] = await Promise.all([
      this.getExecutiveSummary(),
      this.getStockSummary(),
      this.getChannelSummary(),
      this.getCustomerSummaryRows(),
      this.getCriticalStock(),
      this.getBaseCoverage(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      executiveSummary,
      stockSummary,
      channelSummary,
      customerSummary: this.buildCustomerSummary(customerSummaryRows),
      criticalStock,
      alerts: this.buildAlerts(stockSummary, criticalStock, baseCoverage),
      pendingBase: {
        totalItems: DASHBOARD_PENDING_BASE_ITEMS.length,
        items: DASHBOARD_PENDING_BASE_ITEMS,
        note: 'Os itens abaixo permanecem fora da base reconciliada atual e nao entram nas metricas do dashboard.',
      },
      baseCoverage,
    };
  }

  private async getExecutiveSummary(): Promise<DashboardExecutiveSummary> {
    const result = await this.db.query<ExecutiveSummaryRow>(
      `SELECT
         COALESCE(SUM(so.gross_revenue), 0)::text AS "grossRevenue",
         COALESCE(SUM(so.net_revenue), 0)::text AS "netRevenue",
         COALESCE(SUM(so.gross_profit), 0)::text AS "grossProfit",
         CASE
           WHEN COALESCE(SUM(so.net_revenue), 0) > 0
             THEN ROUND(COALESCE(SUM(so.gross_profit), 0) / SUM(so.net_revenue), 4)::text
           ELSE NULL
         END AS "grossMarginPct",
         COUNT(*)::int AS "deliveredOrdersCount"
       FROM soi.sales_orders AS so
       WHERE so.order_status = 'delivered';`,
    );

    return (
      result.rows[0] ?? {
        grossRevenue: '0',
        netRevenue: '0',
        grossProfit: '0',
        grossMarginPct: null,
        deliveredOrdersCount: 0,
      }
    );
  }

  private async getStockSummary(): Promise<DashboardStockSummary> {
    const inventoryBaseQuery = this.buildInventoryStatusBaseQuery();
    const result = await this.db.query<StockSummaryRow>(
      `SELECT
         COALESCE(SUM(inventory."tiedUpCapital"::numeric), 0)::text AS "totalStockValue",
         COUNT(*) FILTER (WHERE inventory."stockStatus" = 'ruptura')::int AS "rupturaCount",
         COUNT(*) FILTER (WHERE inventory."stockStatus" = 'repor_agora')::int AS "reporAgoraCount",
         COUNT(*) FILTER (WHERE inventory."stockStatus" = 'atencao')::int AS "atencaoCount",
         COUNT(*) FILTER (WHERE inventory."stockStatus" = 'ok')::int AS "okCount"
       FROM (${inventoryBaseQuery}) AS inventory;`,
    );

    return (
      result.rows[0] ?? {
        totalStockValue: '0',
        rupturaCount: 0,
        reporAgoraCount: 0,
        atencaoCount: 0,
        okCount: 0,
      }
    );
  }

  private async getChannelSummary(): Promise<DashboardChannelSummary[]> {
    const result = await this.db.query<ChannelSummaryRow>(
      `SELECT
         ch.id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         COUNT(so.id)::int AS "ordersCount",
         COALESCE(SUM(so.gross_revenue), 0)::text AS "grossRevenue",
         COALESCE(SUM(so.net_revenue), 0)::text AS "netRevenue",
         COALESCE(SUM(so.gross_profit), 0)::text AS "grossProfit",
         CASE
           WHEN COALESCE(SUM(so.net_revenue), 0) > 0
             THEN ROUND(COALESCE(SUM(so.gross_profit), 0) / SUM(so.net_revenue), 4)::text
           ELSE NULL
         END AS "grossMarginPct"
       FROM soi.channels AS ch
       LEFT JOIN soi.sales_orders AS so
         ON so.channel_id = ch.id
        AND so.order_status = 'delivered'
       WHERE ch.is_active = true
       GROUP BY ch.id, ch.channel_key, ch.channel_name
       ORDER BY ch.channel_name ASC;`,
    );

    return result.rows;
  }

  private async getCustomerSummaryRows(): Promise<CustomerSummaryRow[]> {
    const statusExpression = this.customerStatusExpression('m', 's');
    const result = await this.db.query<CustomerSummaryRow>(
      `SELECT
         ${statusExpression} AS "customerStatus",
         COUNT(*)::int AS total
       FROM soi.customers AS c
       LEFT JOIN LATERAL (
         SELECT
           cm.orders_count,
           cm.last_purchase_at,
           cm.calculated_at
         FROM soi.customer_metrics AS cm
         WHERE cm.customer_id = c.id
         ORDER BY cm.calculated_at DESC
         LIMIT 1
       ) AS m ON true
       LEFT JOIN LATERAL (
         SELECT
           ss.customer_inactive_days
         FROM soi.system_settings AS ss
         WHERE ss.is_current = true
         ORDER BY ss.effective_from DESC
         LIMIT 1
       ) AS s ON true
       WHERE c.is_active = true
       GROUP BY ${statusExpression};`,
    );

    return result.rows;
  }

  private async getCriticalStock(): Promise<DashboardStockAlertItem[]> {
    const inventoryBaseQuery = this.buildInventoryStatusBaseQuery();
    const result = await this.db.query<StockAlertRow>(
      `SELECT
         inventory.id AS "productId",
         inventory.sku,
         inventory.name,
         inventory."currentStockQty",
         inventory."usedMinStockQty",
         inventory."coverageDays",
         inventory."stockStatus",
         inventory."suggestedPurchaseQty",
         inventory."tiedUpCapital"
       FROM (${inventoryBaseQuery}) AS inventory
       WHERE inventory."stockStatus" <> 'ok'
       ORDER BY
         CASE inventory."stockStatus"
           WHEN 'ruptura' THEN 1
           WHEN 'repor_agora' THEN 2
           WHEN 'atencao' THEN 3
           ELSE 4
         END,
         inventory."suggestedPurchaseQty"::numeric DESC,
         inventory."tiedUpCapital"::numeric DESC,
         inventory.name ASC
       LIMIT 8;`,
    );

    return result.rows;
  }

  private async getBaseCoverage(): Promise<DashboardBaseCoverage> {
    const result = await this.db.query<BaseCoverageRow>(
      `SELECT
         COUNT(*)::text AS "realProducts",
         COUNT(*) FILTER (WHERE pcs.product_id IS NOT NULL)::text AS "productsWithCost",
         COUNT(*) FILTER (WHERE pcs.product_id IS NULL)::text AS "productsWithoutCost"
       FROM soi.products AS p
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id;`,
    );

    return {
      realProducts: Number(result.rows[0]?.realProducts ?? '0'),
      productsWithCost: Number(result.rows[0]?.productsWithCost ?? '0'),
      productsWithoutCost: Number(result.rows[0]?.productsWithoutCost ?? '0'),
    };
  }

  private buildCustomerSummary(rows: CustomerSummaryRow[]): DashboardCustomerSummary {
    const summary: DashboardCustomerSummary = {
      leadCount: 0,
      novoCount: 0,
      recorrenteCount: 0,
      inativoCount: 0,
      totalActiveCustomers: 0,
    };

    rows.forEach((row) => {
      const total = Number(row.total ?? 0);
      summary.totalActiveCustomers += total;

      if (row.customerStatus === 'lead') {
        summary.leadCount += total;
      }

      if (row.customerStatus === 'novo') {
        summary.novoCount += total;
      }

      if (row.customerStatus === 'recorrente') {
        summary.recorrenteCount += total;
      }

      if (row.customerStatus === 'inativo') {
        summary.inativoCount += total;
      }
    });

    return summary;
  }

  private buildAlerts(
    stockSummary: DashboardStockSummary,
    criticalStock: DashboardStockAlertItem[],
    baseCoverage: DashboardBaseCoverage,
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];

    if (stockSummary.rupturaCount > 0) {
      alerts.push({
        id: 'stock-ruptura',
        severity: 'critical',
        title: 'Produtos em ruptura',
        message: `${stockSummary.rupturaCount} produto(s) estao com estoque zerado ou negativo na base reconciliada.`,
        entity: 'Estoque',
        href: '/inventory?stock_status=ruptura',
      });
    }

    if (stockSummary.reporAgoraCount > 0 || stockSummary.atencaoCount > 0) {
      alerts.push({
        id: 'stock-below-min',
        severity: 'high',
        title: 'Produtos abaixo do minimo usado',
        message: `${stockSummary.reporAgoraCount} item(ns) em repor_agora e ${stockSummary.atencaoCount} em atencao.`,
        entity: 'Estoque',
        href: '/inventory?stock_status=repor_agora',
      });
    }

    if (DASHBOARD_PENDING_BASE_ITEMS.length > 0) {
      alerts.push({
        id: 'base-pending',
        severity: 'medium',
        title: 'Pendencias da base reconciliada',
        message: `${DASHBOARD_PENDING_BASE_ITEMS.length} item(ns) permanecem fora da base atual e estao explicitados no dashboard.`,
        entity: 'Base',
        href: '/dashboard#pendencias-base',
      });
    }

    if (baseCoverage.productsWithoutCost > 0) {
      alerts.push({
        id: 'base-without-cost',
        severity: 'high',
        title: 'Produtos sem cobertura de custo',
        message: `${baseCoverage.productsWithoutCost} produto(s) seguem sem snapshot de custo atual.`,
        entity: 'Base',
        href: '/inventory',
      });
    }

    criticalStock.slice(0, 2).forEach((item) => {
      alerts.push({
        id: `stock-item-${item.productId}`,
        severity: item.stockStatus === 'ruptura' ? 'critical' : 'high',
        title: `${item.sku} exige acao`,
        message: `${item.name} esta em ${item.stockStatus} com compra sugerida de ${item.suggestedPurchaseQty}.`,
        entity: 'Estoque',
        href: `/inventory?search=${encodeURIComponent(item.sku)}`,
      });
    });

    return alerts;
  }

  private customerStatusExpression(metricsAlias: string, settingsAlias: string) {
    return `CASE
      WHEN COALESCE(${metricsAlias}.orders_count, 0) <= 0 THEN 'lead'
      WHEN ${metricsAlias}.last_purchase_at IS NOT NULL
        AND ${metricsAlias}.last_purchase_at <
          NOW() - (COALESCE(${settingsAlias}.customer_inactive_days, 45) * INTERVAL '1 day')
        THEN 'inativo'
      WHEN COALESCE(${metricsAlias}.orders_count, 0) = 1 THEN 'novo'
      ELSE 'recorrente'
    END`;
  }

  private buildInventoryStatusBaseQuery() {
    return `
      WITH settings AS (
        SELECT
          replenishment_lead_time_days,
          stock_safety_days
        FROM soi.v_current_system_settings
        LIMIT 1
      ),
      movement_totals AS (
        SELECT
          im.product_id,
          COALESCE(SUM(im.quantity_delta), 0)::numeric AS net_quantity
        FROM soi.inventory_movements AS im
        GROUP BY im.product_id
      ),
      sales_30d AS (
        SELECT
          im.product_id,
          GREATEST(COALESCE(SUM(-im.quantity_delta), 0), 0)::numeric AS delivered_qty_30d
        FROM soi.inventory_movements AS im
        WHERE im.movement_type IN ('sale_out', 'cancel_reversal')
          AND im.movement_date >= NOW() - INTERVAL '30 days'
        GROUP BY im.product_id
      ),
      inventory_base AS (
        SELECT
          p.id,
          p.sku,
          p.name,
          p.category_id AS "categoryId",
          c.name AS "categoryName",
          c.slug AS "categorySlug",
          p.is_active AS "isActive",
          COALESCE(p.min_stock_manual_qty, 0)::numeric AS manual_min_stock_qty,
          COALESCE(p.initial_stock_qty, 0)::numeric AS initial_stock_qty,
          COALESCE(pcs.current_unit_cost, p.base_unit_cost, 0)::numeric AS current_unit_cost,
          s.replenishment_lead_time_days,
          s.stock_safety_days,
          (COALESCE(p.initial_stock_qty, 0) + COALESCE(mt.net_quantity, 0))::numeric AS current_stock_qty,
          (COALESCE(s30.delivered_qty_30d, 0) / 30.0)::numeric AS avg_daily_sales_qty
        FROM soi.products AS p
        LEFT JOIN soi.product_categories AS c ON c.id = p.category_id
        LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
        LEFT JOIN movement_totals AS mt ON mt.product_id = p.id
        LEFT JOIN sales_30d AS s30 ON s30.product_id = p.id
        CROSS JOIN settings AS s
      ),
      inventory_enriched AS (
        SELECT
          ib.id,
          ib.sku,
          ib.name,
          ib."categoryId",
          ib."categoryName",
          ib."categorySlug",
          ib."isActive",
          ROUND(ib.current_unit_cost, 2)::text AS "currentUnitCost",
          ROUND(ib.current_stock_qty, 2)::text AS "currentStockQty",
          ROUND(ib.manual_min_stock_qty, 2)::text AS "manualMinStockQty",
          ROUND(ib.avg_daily_sales_qty, 2)::text AS "avgDailySalesQty",
          ib.replenishment_lead_time_days::int AS "replenishmentLeadTimeDays",
          ib.stock_safety_days::int AS "stockSafetyDays",
          ROUND(ib.avg_daily_sales_qty * (ib.replenishment_lead_time_days + ib.stock_safety_days), 2)::text AS "suggestedMinStockQty",
          ROUND(GREATEST(ib.manual_min_stock_qty, ib.avg_daily_sales_qty * (ib.replenishment_lead_time_days + ib.stock_safety_days)), 2)::text AS "usedMinStockQty",
          CASE
            WHEN ib.avg_daily_sales_qty > 0 AND ib.current_stock_qty > 0 THEN ROUND(ib.current_stock_qty / ib.avg_daily_sales_qty, 2)::text
            WHEN ib.avg_daily_sales_qty > 0 AND ib.current_stock_qty <= 0 THEN '0.00'
            ELSE NULL
          END AS "coverageDays",
          CASE
            WHEN ib.current_stock_qty <= 0 THEN 'ruptura'
            WHEN ib.current_stock_qty < GREATEST(ib.manual_min_stock_qty, ib.avg_daily_sales_qty * (ib.replenishment_lead_time_days + ib.stock_safety_days)) THEN 'repor_agora'
            WHEN ib.current_stock_qty < (GREATEST(ib.manual_min_stock_qty, ib.avg_daily_sales_qty * (ib.replenishment_lead_time_days + ib.stock_safety_days)) * 1.5) THEN 'atencao'
            ELSE 'ok'
          END AS "stockStatus",
          ROUND(GREATEST(GREATEST(ib.manual_min_stock_qty, ib.avg_daily_sales_qty * (ib.replenishment_lead_time_days + ib.stock_safety_days)) - ib.current_stock_qty, 0), 2)::text AS "suggestedPurchaseQty",
          ROUND(ib.current_stock_qty * ib.current_unit_cost, 2)::text AS "tiedUpCapital"
        FROM inventory_base AS ib
      )
      SELECT * FROM inventory_enriched AS inventory`;
  }
}
