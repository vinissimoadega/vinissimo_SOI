import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  INVENTORY_MOVEMENT_TYPES,
  InventoryCategoryOption,
  InventoryMinPriceRow,
  InventoryMovementFilters,
  InventoryMovementRecord,
  InventoryProductOption,
  InventoryStatusFilters,
  InventoryStatusItem,
  STOCK_STATUSES,
  StockStatus,
} from './inventory.types';
import {
  parseRequiredMovementDate,
  parseRequiredText,
  parseRequiredUuid,
  parseSignedNonZeroDecimal,
  parseUnsignedDecimalAllowZero,
} from './inventory.utils';

type InventoryStatusRow = QueryResultRow & InventoryStatusItem;
type InventoryMovementRow = QueryResultRow & InventoryMovementRecord;
type InventoryCategoryRow = QueryResultRow & InventoryCategoryOption;
type InventoryProductRow = QueryResultRow & InventoryProductOption;

type CurrentInventorySettings = {
  marginMinTarget: string;
  replenishmentLeadTimeDays: number;
  stockSafetyDays: number;
  feeWhatsapp: string;
  feeInstagram: string;
  feeIfood: string;
  feeCounter: string;
};

type ManualAdjustmentPayload = {
  adjustmentMode: 'delta_manual' | 'target_balance';
  productId: string;
  movementDate: string;
  quantityDelta?: string;
  targetStockQty?: string;
  notes: string;
};

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  async listInventoryStatus(filters: InventoryStatusFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(inventory.sku ILIKE $${params.length} OR inventory.name ILIKE $${params.length})`,
      );
    }

    if (filters.categoryId) {
      params.push(filters.categoryId);
      where.push(`inventory."categoryId" = $${params.length}`);
    }

    if (filters.stockStatus) {
      params.push(filters.stockStatus);
      where.push(`inventory."stockStatus" = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const baseQuery = this.buildInventoryStatusBaseQuery();

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM (${baseQuery}) AS inventory ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const itemsResult = await this.db.query<InventoryStatusRow>(
      `${baseQuery}
       ${whereClause}
       ORDER BY
         CASE inventory."stockStatus"
           WHEN 'ruptura' THEN 1
           WHEN 'repor_agora' THEN 2
           WHEN 'atencao' THEN 3
           ELSE 4
         END,
         inventory."suggestedPurchaseQty"::numeric DESC,
         inventory.name ASC,
         inventory.sku ASC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    const [categories, settings] = await Promise.all([
      this.listCategories(),
      this.getCurrentSettings(),
    ]);

    return {
      items: itemsResult.rows,
      pagination: {
        page: currentPage,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
      },
      filters: {
        search: filters.search ?? null,
        categoryId: filters.categoryId ?? null,
        stockStatus: filters.stockStatus ?? null,
      },
      meta: {
        categories,
        availableStatuses: [...STOCK_STATUSES],
        currentSettings: {
          replenishmentLeadTimeDays: settings.replenishmentLeadTimeDays,
          stockSafetyDays: settings.stockSafetyDays,
        },
      },
    };
  }

  async listInventoryMovements(filters: InventoryMovementFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.productId) {
      params.push(filters.productId);
      where.push(`im.product_id = $${params.length}`);
    }

    if (filters.movementType) {
      params.push(filters.movementType);
      where.push(`im.movement_type = $${params.length}`);
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      where.push(`im.movement_date::date >= $${params.length}::date`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      where.push(`im.movement_date::date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.inventory_movements AS im
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const itemsResult = await this.db.query<InventoryMovementRow>(
      `SELECT
         im.id,
         im.product_id AS "productId",
         p.sku AS "productSku",
         p.name AS "productName",
         im.movement_type AS "movementType",
         im.movement_date AS "movementDate",
         im.quantity_delta::text AS "quantityDelta",
         im.unit_cost_reference::text AS "unitCostReference",
         im.source_type AS "sourceType",
         im.source_id AS "sourceId",
         im.notes,
         im.created_at AS "createdAt",
         im.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.inventory_movements AS im
       INNER JOIN soi.products AS p ON p.id = im.product_id
       LEFT JOIN soi.users AS u ON u.id = im.created_by
       ${whereClause}
       ORDER BY im.movement_date DESC, im.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    const products = await this.listProductOptions();

    return {
      items: itemsResult.rows,
      pagination: {
        page: currentPage,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
      },
      filters: {
        productId: filters.productId ?? null,
        movementType: filters.movementType ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      meta: {
        products,
        availableMovementTypes: [...INVENTORY_MOVEMENT_TYPES],
      },
    };
  }

  async createManualAdjustment(
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    const payload = this.parseManualAdjustmentPayload(body);
    const product = await this.getProductForAdjustment(payload.productId);
    const currentStockQty = Number(product.currentStockQty);
    const quantityDelta =
      payload.adjustmentMode === 'target_balance'
        ? Number(payload.targetStockQty) - currentStockQty
        : Number(payload.quantityDelta);

    if (Math.abs(quantityDelta) < 0.0001) {
      throw new BadRequestException(
        'O saldo informado não altera o estoque atual deste produto',
      );
    }

    const movementNotes =
      payload.adjustmentMode === 'target_balance'
        ? `Ajuste por saldo-alvo. Saldo atual ${currentStockQty.toFixed(
            2,
          )}. Saldo contado ${Number(payload.targetStockQty).toFixed(
            2,
          )}. Delta aplicado ${quantityDelta.toFixed(2)}. Motivo: ${payload.notes}`
        : `Ajuste manual por delta. Saldo atual ${currentStockQty.toFixed(
            2,
          )}. Delta aplicado ${quantityDelta.toFixed(2)}. Motivo: ${payload.notes}`;

    const insertResult = await this.db.query<{ id: string }>(
      `INSERT INTO soi.inventory_movements (
         product_id,
         movement_type,
         movement_date,
         quantity_delta,
         unit_cost_reference,
         source_type,
         source_id,
         notes,
         created_by
       )
       VALUES ($1, 'adjustment', $2, $3, $4, $5, NULL, $6, $7)
       RETURNING id;`,
      [
        payload.productId,
        payload.movementDate,
        quantityDelta.toFixed(2),
        product.currentUnitCost,
        payload.adjustmentMode === 'target_balance'
          ? 'manual_target_balance'
          : 'manual_adjustment',
        movementNotes,
        currentUser?.id ?? null,
      ],
    );

    const result = await this.db.query<InventoryMovementRow>(
      `SELECT
         im.id,
         im.product_id AS "productId",
         p.sku AS "productSku",
         p.name AS "productName",
         im.movement_type AS "movementType",
         im.movement_date AS "movementDate",
         im.quantity_delta::text AS "quantityDelta",
         im.unit_cost_reference::text AS "unitCostReference",
         im.source_type AS "sourceType",
         im.source_id AS "sourceId",
         im.notes,
         im.created_at AS "createdAt",
         im.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.inventory_movements AS im
       INNER JOIN soi.products AS p ON p.id = im.product_id
       LEFT JOIN soi.users AS u ON u.id = im.created_by
       WHERE im.id = $1
       LIMIT 1;`,
      [insertResult.rows[0].id],
    );

    return result.rows[0];
  }

  async getProductMinPrices(productId: string) {
    const settings = await this.getCurrentSettings();
    const product = await this.getProductForAdjustment(productId);

    const prices: InventoryMinPriceRow[] = [
      {
        channelKey: 'whatsapp',
        channelName: 'WhatsApp',
        feePct: settings.feeWhatsapp,
        marginMinTarget: settings.marginMinTarget,
        currentUnitCost: product.currentUnitCost,
        minimumPrice: this.calculateMinimumPrice(
          product.currentUnitCost,
          settings.feeWhatsapp,
          settings.marginMinTarget,
        ),
      },
      {
        channelKey: 'instagram',
        channelName: 'Instagram',
        feePct: settings.feeInstagram,
        marginMinTarget: settings.marginMinTarget,
        currentUnitCost: product.currentUnitCost,
        minimumPrice: this.calculateMinimumPrice(
          product.currentUnitCost,
          settings.feeInstagram,
          settings.marginMinTarget,
        ),
      },
      {
        channelKey: 'ifood',
        channelName: 'iFood',
        feePct: settings.feeIfood,
        marginMinTarget: settings.marginMinTarget,
        currentUnitCost: product.currentUnitCost,
        minimumPrice: this.calculateMinimumPrice(
          product.currentUnitCost,
          settings.feeIfood,
          settings.marginMinTarget,
        ),
      },
      {
        channelKey: 'balcao',
        channelName: 'Balcão',
        feePct: settings.feeCounter,
        marginMinTarget: settings.marginMinTarget,
        currentUnitCost: product.currentUnitCost,
        minimumPrice: this.calculateMinimumPrice(
          product.currentUnitCost,
          settings.feeCounter,
          settings.marginMinTarget,
        ),
      },
    ];

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      currentUnitCost: product.currentUnitCost,
      marginMinTarget: settings.marginMinTarget,
      prices,
    };
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

  private async listCategories() {
    const result = await this.db.query<InventoryCategoryRow>(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.is_active AS "isActive"
       FROM soi.product_categories AS c
       WHERE c.is_active = true
       ORDER BY c.name ASC;`,
    );

    return result.rows;
  }

  private async listProductOptions() {
    const result = await this.db.query<InventoryProductRow>(
      `WITH movement_totals AS (
         SELECT
           im.product_id,
           COALESCE(SUM(im.quantity_delta), 0)::numeric AS net_quantity
         FROM soi.inventory_movements AS im
         GROUP BY im.product_id
       )
       SELECT
         p.id,
         p.sku,
         p.name,
         p.is_active AS "isActive",
         COALESCE(pcs.current_unit_cost, p.base_unit_cost, 0)::text AS "currentUnitCost",
         (COALESCE(p.initial_stock_qty, 0) + COALESCE(mt.net_quantity, 0))::text AS "currentStockQty"
       FROM soi.products AS p
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       LEFT JOIN movement_totals AS mt ON mt.product_id = p.id
       ORDER BY p.is_active DESC, p.name ASC, p.sku ASC;`,
    );

    return result.rows;
  }

  private async getCurrentSettings(): Promise<CurrentInventorySettings> {
    const result = await this.db.query<
      QueryResultRow & CurrentInventorySettings
    >(
      `SELECT
         margin_min_target::text AS "marginMinTarget",
         replenishment_lead_time_days::int AS "replenishmentLeadTimeDays",
         stock_safety_days::int AS "stockSafetyDays",
         fee_whatsapp::text AS "feeWhatsapp",
         fee_instagram::text AS "feeInstagram",
         fee_ifood::text AS "feeIfood",
         fee_counter::text AS "feeCounter"
       FROM soi.v_current_system_settings
       LIMIT 1;`,
    );

    const settings = result.rows[0];

    if (!settings) {
      throw new NotFoundException('Configuração corrente do sistema não encontrada');
    }

    return settings;
  }

  private async getProductForAdjustment(productId: string) {
    const result = await this.db.query<
      QueryResultRow & {
        id: string;
        sku: string;
        name: string;
        isActive: boolean;
        currentUnitCost: string;
        currentStockQty: string;
      }
    >(
      `WITH movement_totals AS (
         SELECT
           im.product_id,
           COALESCE(SUM(im.quantity_delta), 0)::numeric AS net_quantity
         FROM soi.inventory_movements AS im
         GROUP BY im.product_id
       )
       SELECT
         p.id,
         p.sku,
         p.name,
         p.is_active AS "isActive",
         COALESCE(pcs.current_unit_cost, p.base_unit_cost, 0)::text AS "currentUnitCost",
         (COALESCE(p.initial_stock_qty, 0) + COALESCE(mt.net_quantity, 0))::text AS "currentStockQty"
       FROM soi.products AS p
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       LEFT JOIN movement_totals AS mt ON mt.product_id = p.id
       WHERE p.id = $1
       LIMIT 1;`,
      [productId],
    );

    const product = result.rows[0];

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return product;
  }

  private calculateMinimumPrice(
    currentUnitCost: string,
    feePct: string,
    marginMinTarget: string,
  ) {
    const denominator = 1 - Number(feePct) - Number(marginMinTarget);

    if (denominator <= 0) {
      return null;
    }

    return (Number(currentUnitCost) / denominator).toFixed(2);
  }

  private parseManualAdjustmentPayload(
    body: Record<string, unknown>,
  ): ManualAdjustmentPayload {
    const productId = parseRequiredUuid(body.productId, 'productId');
    const movementDate = parseRequiredMovementDate(body.movementDate, 'movementDate');
    const notes = parseRequiredText(body.notes, 'notes', 1200);
    const adjustmentModeRaw =
      typeof body.adjustmentMode === 'string'
        ? body.adjustmentMode.trim()
        : 'delta_manual';

    if (notes.length < 8) {
      throw new BadRequestException(
        'notes deve descrever o motivo operacional do ajuste manual',
      );
    }

    if (
      adjustmentModeRaw !== 'delta_manual' &&
      adjustmentModeRaw !== 'target_balance'
    ) {
      throw new BadRequestException(
        'adjustmentMode deve ser delta_manual ou target_balance',
      );
    }

    if (adjustmentModeRaw === 'target_balance') {
      return {
        adjustmentMode: 'target_balance',
        productId,
        movementDate,
        targetStockQty: parseUnsignedDecimalAllowZero(
          body.targetStockQty,
          'targetStockQty',
        ),
        notes,
      };
    }

    return {
      adjustmentMode: 'delta_manual',
      productId,
      movementDate,
      quantityDelta: parseSignedNonZeroDecimal(body.quantityDelta, 'quantityDelta'),
      notes,
    };
  }
}
