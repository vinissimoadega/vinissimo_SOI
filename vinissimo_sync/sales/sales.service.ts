import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  SALE_ADDITIONAL_COST_TYPES,
  SaleAdditionalCostRecord,
  SaleAdditionalCostType,
  SaleChannelOption,
  SaleCustomerOption,
  SaleDetailRecord,
  SaleItemRecord,
  SaleListFilters,
  SaleListItem,
  SaleOrderStatus,
  SalePaymentStatus,
  SalePricingPolicy,
  SaleProductOption,
  SALE_ORDER_STATUSES,
} from './sales.types';
import {
  parseOptionalMoney,
  parseOptionalOrderStatus,
  parseOptionalPaymentStatus,
  parseOptionalText,
  parseOptionalUuid,
  parseRequiredMoney,
  parseRequiredPositiveDecimal,
  parseRequiredSaleDate,
  parseRequiredText,
  parseRequiredUuid,
} from './sales.utils';

type SaleRow = QueryResultRow & SaleListItem;
type SaleItemRow = QueryResultRow & SaleItemRecord;
type ChannelRow = QueryResultRow & SaleChannelOption;
type CustomerRow = QueryResultRow & SaleCustomerOption;
type ProductRow = QueryResultRow & SaleProductOption;
type PricingPolicyRow = QueryResultRow & SalePricingPolicy;

type InventoryReconciliationItem = {
  itemId: string;
  productId: string;
  quantity: string;
  costUnit: string;
};

type InventoryMovementBalanceRow = {
  sourceId: string;
  netQuantity: string;
};

type SaleItemPayload = {
  productId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
};

type SaleAdditionalCostPayload = {
  costType: SaleAdditionalCostType;
  description: string;
  amount: string;
  notes: string | null;
};

type SalePayload = {
  saleDate: string;
  customerId: string | null;
  channelId: string;
  orderStatus: SaleOrderStatus;
  paymentStatus: SalePaymentStatus;
  externalChargeReference: string | null;
  paymentNotes: string | null;
  notes: string | null;
  items: SaleItemPayload[];
  additionalCosts: SaleAdditionalCostPayload[];
};

type SalePatch = {
  customerId?: string | null;
  orderStatus?: SaleOrderStatus;
  paymentStatus?: SalePaymentStatus;
  externalChargeReference?: string | null;
  paymentNotes?: string | null;
  notes?: string | null;
};

type CalculatedSaleItem = {
  grossRevenue: string;
  channelFeePct: string;
  netRevenue: string;
  costUnit: string;
  totalCost: string;
  grossProfit: string;
  grossMarginPct: string | null;
  belowMinPriceFlag: boolean;
};

type SaleAdditionalCostRow = QueryResultRow & SaleAdditionalCostRecord;

@Injectable()
export class SalesService {
  constructor(private readonly db: DatabaseService) {}

  async listSales(filters: SaleListFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      const searchParamIndex = params.length;
      const normalizedPhoneDigits = filters.search.replace(/\D/g, '');

      if (normalizedPhoneDigits) {
        params.push(normalizedPhoneDigits);
      }

      where.push(
        `(
          so.sale_number ILIKE $${searchParamIndex}
          OR COALESCE(c.full_name, '') ILIKE $${searchParamIndex}
          OR COALESCE(c.email, '') ILIKE $${searchParamIndex}
          OR COALESCE(c.phone, '') ILIKE $${searchParamIndex}
          ${
            normalizedPhoneDigits
              ? `OR regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') LIKE '%' || $${params.length} || '%'`
              : ''
          }
        )`,
      );
    }

    if (filters.channelId) {
      params.push(filters.channelId);
      where.push(`so.channel_id = $${params.length}`);
    }

    if (filters.customerId) {
      params.push(filters.customerId);
      where.push(`so.customer_id = $${params.length}`);
    }

    if (filters.productId) {
      params.push(filters.productId);
      where.push(
        `EXISTS (
          SELECT 1
          FROM soi.sales_order_items AS soi_filter
          WHERE soi_filter.sales_order_id = so.id
            AND soi_filter.product_id = $${params.length}
        )`,
      );
    }

    if (filters.orderStatus) {
      params.push(filters.orderStatus);
      where.push(`so.order_status = $${params.length}`);
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      where.push(`so.sale_date::date >= $${params.length}::date`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      where.push(`so.sale_date::date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.sales_orders AS so
       LEFT JOIN soi.customers AS c ON c.id = so.customer_id
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const itemsResult = await this.db.query<SaleRow>(
      `SELECT
         so.id,
         so.sale_number AS "saleNumber",
         so.sale_date AS "saleDate",
         so.customer_id AS "customerId",
         c.full_name AS "customerName",
         so.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         so.order_status AS "orderStatus",
         so.payment_status AS "paymentStatus",
         so.external_charge_reference AS "externalChargeReference",
         so.payment_notes AS "paymentNotes",
         COALESCE(additional_costs.additional_cost_total, 0)::text AS "additionalCostTotal",
         COALESCE(so.gross_revenue, 0)::text AS "grossRevenue",
         COALESCE(so.net_revenue, 0)::text AS "netRevenue",
         COALESCE(so.gross_profit, 0)::text AS "grossProfit",
         so.gross_margin_pct::text AS "grossMarginPct",
         so.notes,
         COALESCE(item_counts.items_count, 0)::int AS "itemsCount",
         so.created_at AS "createdAt",
         so.updated_at AS "updatedAt",
         so.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.sales_orders AS so
       LEFT JOIN soi.customers AS c ON c.id = so.customer_id
       INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
       LEFT JOIN soi.users AS u ON u.id = so.created_by
       LEFT JOIN (
         SELECT sales_order_id, COUNT(*)::int AS items_count
         FROM soi.sales_order_items
         GROUP BY sales_order_id
       ) AS item_counts ON item_counts.sales_order_id = so.id
       LEFT JOIN (
         SELECT
           sales_order_id,
           COALESCE(SUM(amount), 0)::numeric AS additional_cost_total
         FROM soi.sales_order_additional_costs
         GROUP BY sales_order_id
       ) AS additional_costs ON additional_costs.sales_order_id = so.id
       ${whereClause}
       ORDER BY so.sale_date DESC, so.created_at DESC, so.sale_number DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    const pricingPolicy = await this.getCurrentPricingPolicy();
    const [channels, customers, products] = await Promise.all([
      this.listChannels(pricingPolicy),
      this.listCustomers(),
      this.listProducts(),
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
        channelId: filters.channelId ?? null,
        customerId: filters.customerId ?? null,
        productId: filters.productId ?? null,
        orderStatus: filters.orderStatus ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      meta: {
        channels,
        customers,
        products,
        availableStatuses: [...SALE_ORDER_STATUSES],
        pricingPolicy: {
          marginMinTarget: pricingPolicy.marginMinTarget,
        },
      },
    };
  }

  async getSaleById(saleId: string): Promise<SaleDetailRecord> {
    const saleResult = await this.db.query<SaleRow>(
      `SELECT
         so.id,
         so.sale_number AS "saleNumber",
         so.sale_date AS "saleDate",
         so.customer_id AS "customerId",
         c.full_name AS "customerName",
         so.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         so.order_status AS "orderStatus",
         so.payment_status AS "paymentStatus",
         so.external_charge_reference AS "externalChargeReference",
         so.payment_notes AS "paymentNotes",
         COALESCE(additional_costs.additional_cost_total, 0)::text AS "additionalCostTotal",
         COALESCE(so.gross_revenue, 0)::text AS "grossRevenue",
         COALESCE(so.net_revenue, 0)::text AS "netRevenue",
         COALESCE(so.gross_profit, 0)::text AS "grossProfit",
         so.gross_margin_pct::text AS "grossMarginPct",
         so.notes,
         COALESCE(item_counts.items_count, 0)::int AS "itemsCount",
         so.created_at AS "createdAt",
         so.updated_at AS "updatedAt",
         so.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.sales_orders AS so
       LEFT JOIN soi.customers AS c ON c.id = so.customer_id
       INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
       LEFT JOIN soi.users AS u ON u.id = so.created_by
       LEFT JOIN (
         SELECT sales_order_id, COUNT(*)::int AS items_count
         FROM soi.sales_order_items
         GROUP BY sales_order_id
       ) AS item_counts ON item_counts.sales_order_id = so.id
       LEFT JOIN (
         SELECT
           sales_order_id,
           COALESCE(SUM(amount), 0)::numeric AS additional_cost_total
         FROM soi.sales_order_additional_costs
         GROUP BY sales_order_id
       ) AS additional_costs ON additional_costs.sales_order_id = so.id
       WHERE so.id = $1
       LIMIT 1;`,
      [saleId],
    );

    const sale = saleResult.rows[0];

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    const itemsResult = await this.db.query<SaleItemRow>(
      `SELECT
         soi.id,
         soi.sales_order_id AS "salesOrderId",
         soi.product_id AS "productId",
         p.sku AS "productSku",
         p.name AS "productName",
         soi.quantity::text AS quantity,
         soi.unit_price::text AS "unitPrice",
         soi.discount_amount::text AS "discountAmount",
         soi.gross_revenue::text AS "grossRevenue",
         soi.channel_fee_pct::text AS "channelFeePct",
         soi.net_revenue::text AS "netRevenue",
         soi.cost_unit::text AS "costUnit",
         soi.total_cost::text AS "totalCost",
         soi.gross_profit::text AS "grossProfit",
         soi.gross_margin_pct::text AS "grossMarginPct",
         soi.below_min_price_flag AS "belowMinPriceFlag",
         soi.created_at AS "createdAt"
       FROM soi.sales_order_items AS soi
       INNER JOIN soi.products AS p ON p.id = soi.product_id
       WHERE soi.sales_order_id = $1
       ORDER BY soi.created_at ASC, p.name ASC;`,
      [saleId],
    );

    const additionalCostsResult = await this.db.query<SaleAdditionalCostRow>(
      `SELECT
         sac.id,
         sac.sales_order_id AS "salesOrderId",
         sac.cost_type AS "costType",
         sac.description,
         sac.amount::text AS amount,
         sac.notes,
         sac.created_at AS "createdAt",
         sac.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.sales_order_additional_costs AS sac
       LEFT JOIN soi.users AS u ON u.id = sac.created_by
       WHERE sac.sales_order_id = $1
       ORDER BY sac.created_at ASC, sac.description ASC;`,
      [saleId],
    );

    return {
      ...sale,
      items: itemsResult.rows,
      additionalCosts: additionalCostsResult.rows,
    };
  }

  async createSale(
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    const payload = this.parseCreatePayload(body);

    await this.ensureCustomerExists(payload.customerId);

    const pricingPolicy = await this.getCurrentPricingPolicy();
    const channel = await this.getChannelById(payload.channelId, pricingPolicy);
    const productCosts = await this.getProductCosts(
      payload.items.map((item) => item.productId),
    );

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const saleNumber = await this.generateNextSaleNumber(client);
        const saleInsert = await client.query<{ id: string }>(
          `INSERT INTO soi.sales_orders (
             sale_number,
             sale_date,
             customer_id,
             channel_id,
             order_status,
             payment_status,
             external_charge_reference,
             payment_notes,
             gross_revenue,
             net_revenue,
             gross_profit,
             gross_margin_pct,
             notes,
             created_by,
             updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
           RETURNING id;`,
          [
            saleNumber,
            payload.saleDate,
            payload.customerId,
            payload.channelId,
            payload.orderStatus,
            payload.paymentStatus,
            payload.externalChargeReference,
            payload.paymentNotes,
            '0.00',
            '0.00',
            '0.00',
            null,
            payload.notes,
            currentUser?.id ?? null,
          ],
        );

        const saleId = saleInsert.rows[0].id;
        let orderGrossRevenue = 0;
        let orderNetRevenue = 0;
        let orderGrossProfit = 0;
        let orderAdditionalCostTotal = 0;
        const inventoryItems: InventoryReconciliationItem[] = [];

        for (const item of payload.items) {
          const costUnit = productCosts.get(item.productId);

          if (!costUnit) {
            throw new BadRequestException(
              'Um ou mais produtos da venda ainda não possuem custo operacional atual',
            );
          }

          const calculated = this.calculateItemMetrics(
            item,
            channel.feePct,
            pricingPolicy.marginMinTarget,
            costUnit,
          );

          const itemInsert = await client.query<{ id: string }>(
            `INSERT INTO soi.sales_order_items (
               sales_order_id,
               product_id,
               quantity,
               unit_price,
               discount_amount,
               gross_revenue,
               channel_fee_pct,
               net_revenue,
               cost_unit,
               total_cost,
               gross_profit,
               gross_margin_pct,
               below_min_price_flag
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id;`,
            [
              saleId,
              item.productId,
              item.quantity,
              item.unitPrice,
              item.discountAmount,
              calculated.grossRevenue,
              calculated.channelFeePct,
              calculated.netRevenue,
              calculated.costUnit,
              calculated.totalCost,
              calculated.grossProfit,
              calculated.grossMarginPct,
              calculated.belowMinPriceFlag,
            ],
          );

          inventoryItems.push({
            itemId: itemInsert.rows[0].id,
            productId: item.productId,
            quantity: item.quantity,
            costUnit: calculated.costUnit,
          });

          orderGrossRevenue += Number(calculated.grossRevenue);
          orderNetRevenue += Number(calculated.netRevenue);
          orderGrossProfit += Number(calculated.grossProfit);
        }

        for (const additionalCost of payload.additionalCosts) {
          await client.query(
            `INSERT INTO soi.sales_order_additional_costs (
               sales_order_id,
               cost_type,
               description,
               amount,
               notes,
               created_by
             )
             VALUES ($1, $2, $3, $4, $5, $6);`,
            [
              saleId,
              additionalCost.costType,
              additionalCost.description,
              additionalCost.amount,
              additionalCost.notes,
              currentUser?.id ?? null,
            ],
          );

          orderAdditionalCostTotal += Number(additionalCost.amount);
        }

        await client.query(
          `UPDATE soi.sales_orders
           SET gross_revenue = $1,
               net_revenue = $2,
               gross_profit = $3,
               gross_margin_pct = $4
           WHERE id = $5;`,
          [
            orderGrossRevenue.toFixed(2),
            orderNetRevenue.toFixed(2),
            (orderGrossProfit - orderAdditionalCostTotal).toFixed(2),
            orderNetRevenue > 0
              ? (
                  (orderGrossProfit - orderAdditionalCostTotal) /
                  orderNetRevenue
                ).toFixed(4)
              : null,
            saleId,
          ],
        );

        await this.reconcileInventoryForSale(
          client,
          {
            id: saleId,
            saleNumber,
            saleDate: payload.saleDate,
            orderStatus: payload.orderStatus,
          },
          inventoryItems,
          currentUser,
        );

        await client.query('COMMIT');

        return this.getSaleById(saleId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async updateSale(
    saleId: string,
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    const patch = this.parseUpdatePayload(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'PATCH de venda está restrito ao cabeçalho: customerId, orderStatus, paymentStatus, externalChargeReference, paymentNotes e notes',
      );
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const existingSale = await this.getSaleHeaderForUpdate(client, saleId);

        if (patch.customerId !== undefined) {
          await this.ensureCustomerExists(patch.customerId);
        }

        const assignments: string[] = ['updated_at = NOW()'];
        const params: unknown[] = [];

        if (patch.customerId !== undefined) {
          params.push(patch.customerId);
          assignments.push(`customer_id = $${params.length}`);
        }

        if (patch.orderStatus !== undefined) {
          params.push(patch.orderStatus);
          assignments.push(`order_status = $${params.length}`);
        }

        if (patch.notes !== undefined) {
          params.push(patch.notes);
          assignments.push(`notes = $${params.length}`);
        }

        if (patch.paymentStatus !== undefined) {
          params.push(patch.paymentStatus);
          assignments.push(`payment_status = $${params.length}`);
        }

        if (patch.externalChargeReference !== undefined) {
          params.push(patch.externalChargeReference);
          assignments.push(`external_charge_reference = $${params.length}`);
        }

        if (patch.paymentNotes !== undefined) {
          params.push(patch.paymentNotes);
          assignments.push(`payment_notes = $${params.length}`);
        }

        params.push(saleId);

        await client.query(
          `UPDATE soi.sales_orders
           SET ${assignments.join(', ')}
           WHERE id = $${params.length};`,
          params,
        );

        if (
          patch.orderStatus !== undefined &&
          patch.orderStatus !== existingSale.orderStatus
        ) {
          const saleItems = await this.getSaleInventoryItems(client, saleId);
          await this.reconcileInventoryForSale(
            client,
            {
              id: saleId,
              saleNumber: existingSale.saleNumber,
              saleDate: existingSale.saleDate,
              orderStatus: patch.orderStatus,
            },
            saleItems,
            currentUser,
          );
        }

        await client.query('COMMIT');

        return this.getSaleById(saleId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  private async getSaleHeaderForUpdate(client: PoolClient, saleId: string) {
    const result = await client.query<{
      id: string;
      saleNumber: string;
      saleDate: string;
      orderStatus: SaleOrderStatus;
    }>(
      `SELECT
         so.id,
         so.sale_number AS "saleNumber",
         so.sale_date AS "saleDate",
         so.order_status AS "orderStatus"
       FROM soi.sales_orders AS so
       WHERE so.id = $1
       LIMIT 1
       FOR UPDATE;`,
      [saleId],
    );

    const sale = result.rows[0];

    if (!sale) {
      throw new NotFoundException('Venda não encontrada');
    }

    return sale;
  }

  private async getSaleInventoryItems(client: PoolClient, saleId: string) {
    const result = await client.query<InventoryReconciliationItem>(
      `SELECT
         soi.id AS "itemId",
         soi.product_id AS "productId",
         soi.quantity::text AS quantity,
         soi.cost_unit::text AS "costUnit"
       FROM soi.sales_order_items AS soi
       WHERE soi.sales_order_id = $1
       ORDER BY soi.created_at ASC;`,
      [saleId],
    );

    return result.rows;
  }

  private async reconcileInventoryForSale(
    client: PoolClient,
    sale: {
      id: string;
      saleNumber: string;
      saleDate: string;
      orderStatus: SaleOrderStatus;
    },
    items: InventoryReconciliationItem[],
    currentUser?: AuthenticatedUser,
  ) {
    if (items.length === 0) {
      return;
    }

    const balancesResult = await client.query<InventoryMovementBalanceRow>(
      `SELECT
         im.source_id AS "sourceId",
         COALESCE(SUM(im.quantity_delta), 0)::text AS "netQuantity"
       FROM soi.inventory_movements AS im
       WHERE im.source_type = 'sales_order_item'
         AND im.source_id = ANY($1::uuid[])
       GROUP BY im.source_id;`,
      [items.map((item) => item.itemId)],
    );

    const balances = new Map(
      balancesResult.rows.map((row) => [row.sourceId, Number(row.netQuantity)]),
    );

    const epsilon = 0.0001;

    for (const item of items) {
      const currentNetQuantity = balances.get(item.itemId) ?? 0;
      const deliveredQuantity = -Number(item.quantity);
      const desiredNetQuantity =
        sale.orderStatus === 'delivered' ? deliveredQuantity : 0;

      if (Math.abs(currentNetQuantity - desiredNetQuantity) < epsilon) {
        continue;
      }

      if (
        Math.abs(currentNetQuantity) < epsilon &&
        Math.abs(desiredNetQuantity - deliveredQuantity) < epsilon
      ) {
        await client.query(
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
           VALUES ($1, 'sale_out', $2, $3, $4, 'sales_order_item', $5, $6, $7);`,
          [
            item.productId,
            sale.saleDate,
            deliveredQuantity.toFixed(2),
            item.costUnit,
            item.itemId,
            `Baixa por venda ${sale.saleNumber}`,
            currentUser?.id ?? null,
          ],
        );
        continue;
      }

      if (
        Math.abs(currentNetQuantity - deliveredQuantity) < epsilon &&
        Math.abs(desiredNetQuantity) < epsilon
      ) {
        await client.query(
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
           VALUES ($1, 'cancel_reversal', $2, $3, $4, 'sales_order_item', $5, $6, $7);`,
          [
            item.productId,
            sale.saleDate,
            Number(item.quantity).toFixed(2),
            item.costUnit,
            item.itemId,
            `Reversão por status ${sale.orderStatus} da venda ${sale.saleNumber}`,
            currentUser?.id ?? null,
          ],
        );
        continue;
      }

      throw new ConflictException(
        `Movimentação de estoque inconsistente para o item ${item.itemId} da venda ${sale.saleNumber}`,
      );
    }
  }
  private async listChannels(pricingPolicy: SalePricingPolicy) {
    const result = await this.db.query<ChannelRow>(
      `SELECT
         c.id,
         c.channel_key AS "channelKey",
         c.channel_name AS "channelName",
         c.is_active AS "isActive"
       FROM soi.channels AS c
       WHERE c.is_active = true
       ORDER BY c.channel_name ASC;`,
    );

    return result.rows.map((channel) => ({
      ...channel,
      feePct: this.mapChannelFee(channel.channelKey, pricingPolicy),
    }));
  }

  private async listCustomers() {
    const result = await this.db.query<CustomerRow>(
      `SELECT
         c.id,
         c.customer_code AS "customerCode",
         c.full_name AS "fullName",
         c.email,
         c.phone,
         c.is_active AS "isActive"
       FROM soi.customers AS c
       WHERE c.is_active = true
       ORDER BY c.full_name ASC;`,
    );

    return result.rows;
  }

  private async listProducts() {
    const result = await this.db.query<ProductRow>(
      `SELECT
         p.id,
         p.sku,
         p.name,
         pcs.current_unit_cost::text AS "currentUnitCost",
         p.is_active AS "isActive"
       FROM soi.products AS p
       INNER JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       WHERE p.is_active = true
       ORDER BY p.name ASC, p.sku ASC;`,
    );

    return result.rows;
  }

  private async getCurrentPricingPolicy(): Promise<SalePricingPolicy> {
    const result = await this.db.query<PricingPolicyRow>(
      `SELECT
         margin_min_target::text AS "marginMinTarget",
         fee_whatsapp::text AS "feeWhatsapp",
         fee_instagram::text AS "feeInstagram",
         fee_ifood::text AS "feeIfood",
         fee_counter::text AS "feeCounter"
       FROM soi.v_current_system_settings
       LIMIT 1;`,
    );

    const pricingPolicy = result.rows[0];

    if (!pricingPolicy) {
      throw new NotFoundException(
        'Configuração corrente do sistema não encontrada para cálculo da venda',
      );
    }

    return pricingPolicy;
  }

  private async getChannelById(
    channelId: string,
    pricingPolicy: SalePricingPolicy,
  ) {
    const result = await this.db.query<{
      id: string;
      channelKey: string;
      channelName: string;
      isActive: boolean;
    }>(
      `SELECT
         c.id,
         c.channel_key AS "channelKey",
         c.channel_name AS "channelName",
         c.is_active AS "isActive"
       FROM soi.channels AS c
       WHERE c.id = $1
       LIMIT 1;`,
      [channelId],
    );

    const channel = result.rows[0];

    if (!channel) {
      throw new NotFoundException('Canal não encontrado');
    }

    return {
      ...channel,
      feePct: this.mapChannelFee(channel.channelKey, pricingPolicy),
    };
  }

  private async ensureCustomerExists(customerId: string | null | undefined) {
    if (!customerId) {
      return;
    }

    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM soi.customers
         WHERE id = $1
       ) AS exists;`,
      [customerId],
    );

    if (!result.rows[0]?.exists) {
      throw new NotFoundException('Cliente não encontrado');
    }
  }

  private async getProductCosts(productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];

    const result = await this.db.query<{
      id: string;
      currentUnitCost: string | null;
    }>(
      `SELECT
         p.id,
         pcs.current_unit_cost::text AS "currentUnitCost"
       FROM soi.products AS p
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       WHERE p.id = ANY($1::uuid[]);`,
      [uniqueIds],
    );

    if (result.rows.length !== uniqueIds.length) {
      throw new NotFoundException('Um ou mais produtos da venda não foram encontrados');
    }

    const missingCosts = result.rows.filter((row) => !row.currentUnitCost);

    if (missingCosts.length > 0) {
      throw new BadRequestException(
        'Um ou mais produtos da venda ainda não possuem custo operacional atual',
      );
    }

    return new Map(
      result.rows.map((row) => [row.id, row.currentUnitCost as string]),
    );
  }

  private async ensureSaleNumberAvailable(
    saleNumber: string,
    saleId?: string,
  ) {
    const params: unknown[] = [saleNumber];
    let exclusion = '';

    if (saleId) {
      params.push(saleId);
      exclusion = `AND id <> $${params.length}`;
    }

    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM soi.sales_orders
         WHERE sale_number = $1
         ${exclusion}
       ) AS exists;`,
      params,
    );

    if (result.rows[0]?.exists) {
      throw new ConflictException('saleNumber já está em uso');
    }
  }

  private calculateItemMetrics(
    item: SaleItemPayload,
    channelFeePct: string,
    marginMinTarget: string,
    costUnit: string,
  ): CalculatedSaleItem {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discountAmount = Number(item.discountAmount);
    const feePct = Number(channelFeePct);
    const unitCost = Number(costUnit);
    const marginTarget = Number(marginMinTarget);
    const grossRevenue = unitPrice * quantity - discountAmount;

    if (grossRevenue < 0) {
      throw new BadRequestException(
        'discountAmount não pode exceder a receita bruta do item',
      );
    }

    const netRevenue = grossRevenue * (1 - feePct);
    const totalCost = unitCost * quantity;
    const grossProfit = netRevenue - totalCost;
    const grossMarginPct = netRevenue > 0 ? grossProfit / netRevenue : null;

    const denominator = 1 - feePct - marginTarget;

    if (denominator <= 0) {
      throw new BadRequestException(
        'A configuração corrente do sistema inviabiliza o cálculo do preço mínimo para este canal',
      );
    }

    const minimumUnitPrice = unitCost / denominator;
    const practicedUnitPrice = grossRevenue / quantity;

    return {
      grossRevenue: grossRevenue.toFixed(2),
      channelFeePct: feePct.toFixed(4),
      netRevenue: netRevenue.toFixed(2),
      costUnit: unitCost.toFixed(2),
      totalCost: totalCost.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      grossMarginPct:
        grossMarginPct === null ? null : grossMarginPct.toFixed(4),
      belowMinPriceFlag: practicedUnitPrice < minimumUnitPrice,
    };
  }

  private mapChannelFee(channelKey: string, pricingPolicy: SalePricingPolicy) {
    switch (channelKey) {
      case 'whatsapp':
        return pricingPolicy.feeWhatsapp;
      case 'instagram':
        return pricingPolicy.feeInstagram;
      case 'ifood':
        return pricingPolicy.feeIfood;
      case 'balcao':
        return pricingPolicy.feeCounter;
      default:
        return '0.0000';
    }
  }

  private parseCreatePayload(body: Record<string, unknown>): SalePayload {
    const rawItems = Array.isArray(body.items) ? body.items : null;
    const rawAdditionalCosts = Array.isArray(body.additionalCosts)
      ? body.additionalCosts
      : [];

    if (!rawItems || rawItems.length === 0) {
      throw new BadRequestException('items deve conter pelo menos um item');
    }

    const items = rawItems.map((item, index) =>
      this.parseItemPayload(item, `items[${index}]`),
    );
    const additionalCosts = rawAdditionalCosts.map((item, index) =>
      this.parseAdditionalCostPayload(item, `additionalCosts[${index}]`),
    );

    return {
      saleDate: parseRequiredSaleDate(body.saleDate, 'saleDate'),
      customerId: parseOptionalUuid(body.customerId, 'customerId') ?? null,
      channelId: parseRequiredUuid(body.channelId, 'channelId'),
      orderStatus:
        parseOptionalOrderStatus(body.orderStatus, 'orderStatus') ?? 'pending',
      paymentStatus:
        parseOptionalPaymentStatus(body.paymentStatus, 'paymentStatus') ?? 'unpaid',
      externalChargeReference:
        parseOptionalText(
          body.externalChargeReference,
          'externalChargeReference',
          120,
        ) ?? null,
      paymentNotes: parseOptionalText(body.paymentNotes, 'paymentNotes', 1200) ?? null,
      notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
      items,
      additionalCosts,
    };
  }

  private parseUpdatePayload(body: Record<string, unknown>): SalePatch {
    const patch: SalePatch = {};

    const customerId = parseOptionalUuid(body.customerId, 'customerId');
    if (customerId !== undefined) {
      patch.customerId = customerId;
    }

    const orderStatus = parseOptionalOrderStatus(body.orderStatus, 'orderStatus');
    if (orderStatus !== undefined) {
      if (orderStatus === null) {
        throw new BadRequestException('orderStatus é obrigatório');
      }
      patch.orderStatus = orderStatus;
    }

    const notes = parseOptionalText(body.notes, 'notes', 1200);
    if (notes !== undefined) {
      patch.notes = notes;
    }

    const paymentStatus = parseOptionalPaymentStatus(
      body.paymentStatus,
      'paymentStatus',
    );
    if (paymentStatus !== undefined) {
      if (paymentStatus === null) {
        throw new BadRequestException('paymentStatus é obrigatório');
      }
      patch.paymentStatus = paymentStatus;
    }

    const externalChargeReference = parseOptionalText(
      body.externalChargeReference,
      'externalChargeReference',
      120,
    );
    if (externalChargeReference !== undefined) {
      patch.externalChargeReference = externalChargeReference;
    }

    const paymentNotes = parseOptionalText(
      body.paymentNotes,
      'paymentNotes',
      1200,
    );
    if (paymentNotes !== undefined) {
      patch.paymentNotes = paymentNotes;
    }

    return patch;
  }

  private async generateNextSaleNumber(client: PoolClient) {
    await client.query(`SELECT pg_advisory_xact_lock(2501002);`);

    const result = await client.query<{ lastNumber: number }>(
      `SELECT
         COALESCE(MAX(((regexp_match(sale_number, '^VEN-(\\d{6})$'))[1])::int), 0) AS "lastNumber"
       FROM soi.sales_orders
       WHERE sale_number ~ '^VEN-(\\d{6})$';`,
    );

    const nextNumber = Number(result.rows[0]?.lastNumber ?? 0) + 1;
    return `VEN-${String(nextNumber).padStart(6, '0')}`;
  }

  private parseItemPayload(rawItem: unknown, path: string): SaleItemPayload {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new BadRequestException(`${path} deve ser um objeto`);
    }

    const item = rawItem as Record<string, unknown>;

    return {
      productId: parseRequiredUuid(item.productId, `${path}.productId`),
      quantity: parseRequiredPositiveDecimal(item.quantity, `${path}.quantity`),
      unitPrice: parseRequiredMoney(item.unitPrice, `${path}.unitPrice`),
      discountAmount:
        parseOptionalMoney(item.discountAmount, `${path}.discountAmount`) ??
        '0.00',
    };
  }

  private parseAdditionalCostPayload(
    rawCost: unknown,
    path: string,
  ): SaleAdditionalCostPayload {
    if (!rawCost || typeof rawCost !== 'object' || Array.isArray(rawCost)) {
      throw new BadRequestException(`${path} deve ser um objeto`);
    }

    const cost = rawCost as Record<string, unknown>;
    const costType = parseRequiredText(cost.costType, `${path}.costType`, 40);

    if (!SALE_ADDITIONAL_COST_TYPES.includes(costType as SaleAdditionalCostType)) {
      throw new BadRequestException(`${path}.costType inválido`);
    }

    return {
      costType: costType as SaleAdditionalCostType,
      description: parseRequiredText(cost.description, `${path}.description`, 160),
      amount: parseRequiredMoney(cost.amount, `${path}.amount`),
      notes: parseOptionalText(cost.notes, `${path}.notes`, 1200) ?? null,
    };
  }
}
