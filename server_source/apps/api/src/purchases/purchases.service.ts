import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { FinancialService } from '../financial/financial.service';
import {
  PurchaseDetailRecord,
  PurchaseItemRecord,
  PurchaseListFilters,
  PurchaseListItem,
  PurchaseProductOption,
  PurchaseSupplierOption,
} from './purchases.types';
import {
  parseOptionalMoney,
  parseOptionalText,
  parseOptionalUuid,
  parseRequiredMoney,
  parseRequiredPositiveDecimal,
  parseRequiredPurchaseDate,
  parseRequiredText,
  parseRequiredUuid,
} from './purchases.utils';

type PurchaseRow = QueryResultRow & PurchaseListItem;
type PurchaseItemRow = QueryResultRow & PurchaseItemRecord;
type SupplierRow = QueryResultRow & PurchaseSupplierOption;
type ProductRow = QueryResultRow & PurchaseProductOption;

type PurchaseItemPayload = {
  productId: string;
  quantity: string;
  unitCost: string;
  freightAllocated: string;
  extraCostAllocated: string;
};

type PurchasePayload = {
  purchaseNumber: string;
  supplierId: string | null;
  purchaseDate: string;
  notes: string | null;
  items: PurchaseItemPayload[];
};

type PurchasePatch = {
  purchaseNumber?: string;
  supplierId?: string | null;
  notes?: string | null;
};

@Injectable()
export class PurchasesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly financialService: FinancialService,
  ) {}

  async listPurchases(filters: PurchaseListFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(
          po.purchase_number ILIKE $${params.length}
          OR COALESCE(s.name, '') ILIKE $${params.length}
          OR COALESCE(s.supplier_code, '') ILIKE $${params.length}
        )`,
      );
    }

    if (filters.supplierId) {
      params.push(filters.supplierId);
      where.push(`po.supplier_id = $${params.length}`);
    }

    if (filters.productId) {
      params.push(filters.productId);
      where.push(
        `EXISTS (
          SELECT 1
          FROM soi.purchase_order_items AS poi_filter
          WHERE poi_filter.purchase_order_id = po.id
            AND poi_filter.product_id = $${params.length}
        )`,
      );
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      where.push(`po.purchase_date::date >= $${params.length}::date`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      where.push(`po.purchase_date::date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.purchase_orders AS po
       LEFT JOIN soi.suppliers AS s ON s.id = po.supplier_id
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const itemsResult = await this.db.query<PurchaseRow>(
      `SELECT
         po.id,
         po.purchase_number AS "purchaseNumber",
         po.supplier_id AS "supplierId",
         s.supplier_code AS "supplierCode",
         s.name AS "supplierName",
         po.purchase_date AS "purchaseDate",
         po.notes,
         COALESCE(po.total_amount, 0)::text AS "totalAmount",
         COALESCE(item_counts.items_count, 0)::int AS "itemsCount",
         po.created_at AS "createdAt",
         po.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.purchase_orders AS po
       LEFT JOIN soi.suppliers AS s ON s.id = po.supplier_id
       LEFT JOIN soi.users AS u ON u.id = po.created_by
       LEFT JOIN (
         SELECT purchase_order_id, COUNT(*)::int AS items_count
         FROM soi.purchase_order_items
         GROUP BY purchase_order_id
       ) AS item_counts ON item_counts.purchase_order_id = po.id
       ${whereClause}
       ORDER BY po.purchase_date DESC, po.created_at DESC, po.purchase_number DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    const [suppliers, products] = await Promise.all([
      this.listSuppliers(),
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
        supplierId: filters.supplierId ?? null,
        productId: filters.productId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      meta: {
        suppliers,
        products,
      },
    };
  }

  async getPurchaseById(purchaseId: string): Promise<PurchaseDetailRecord> {
    const purchaseResult = await this.db.query<PurchaseRow>(
      `SELECT
         po.id,
         po.purchase_number AS "purchaseNumber",
         po.supplier_id AS "supplierId",
         s.supplier_code AS "supplierCode",
         s.name AS "supplierName",
         po.purchase_date AS "purchaseDate",
         po.notes,
         COALESCE(po.total_amount, 0)::text AS "totalAmount",
         COALESCE(item_counts.items_count, 0)::int AS "itemsCount",
         po.created_at AS "createdAt",
         po.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.purchase_orders AS po
       LEFT JOIN soi.suppliers AS s ON s.id = po.supplier_id
       LEFT JOIN soi.users AS u ON u.id = po.created_by
       LEFT JOIN (
         SELECT purchase_order_id, COUNT(*)::int AS items_count
         FROM soi.purchase_order_items
         GROUP BY purchase_order_id
       ) AS item_counts ON item_counts.purchase_order_id = po.id
       WHERE po.id = $1
       LIMIT 1;`,
      [purchaseId],
    );

    const purchase = purchaseResult.rows[0];

    if (!purchase) {
      throw new NotFoundException('Compra não encontrada');
    }

    const itemsResult = await this.db.query<PurchaseItemRow>(
      `SELECT
         poi.id,
         poi.purchase_order_id AS "purchaseOrderId",
         poi.product_id AS "productId",
         p.sku AS "productSku",
         p.name AS "productName",
         poi.quantity::text AS quantity,
         poi.unit_cost::text AS "unitCost",
         poi.freight_allocated::text AS "freightAllocated",
         poi.extra_cost_allocated::text AS "extraCostAllocated",
         poi.total_cost::text AS "totalCost",
         poi.real_unit_cost::text AS "realUnitCost",
         poi.created_at AS "createdAt"
       FROM soi.purchase_order_items AS poi
       INNER JOIN soi.products AS p ON p.id = poi.product_id
       WHERE poi.purchase_order_id = $1
       ORDER BY poi.created_at ASC, p.name ASC;`,
      [purchaseId],
    );

    return {
      ...purchase,
      items: itemsResult.rows,
    };
  }

  async createPurchase(
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    const payload = this.parseCreatePayload(body);

    await this.ensurePurchaseNumberAvailable(payload.purchaseNumber);
    await this.ensureSupplierExists(payload.supplierId);
    await this.ensureProductsExist(payload.items.map((item) => item.productId));

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const purchaseInsert = await client.query<{ id: string }>(
          `INSERT INTO soi.purchase_orders (
             purchase_number,
             supplier_id,
             purchase_date,
             notes,
             total_amount,
             created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id;`,
          [
            payload.purchaseNumber,
            payload.supplierId,
            payload.purchaseDate,
            payload.notes,
            '0.00',
            currentUser?.id ?? null,
          ],
        );

        const purchaseId = purchaseInsert.rows[0].id;
        let totalAmount = 0;
        const affectedProducts = new Set<string>();

        for (const item of payload.items) {
          const calculated = this.calculateItemCosts(item);
          totalAmount += Number(calculated.totalCost);

          const itemInsert = await client.query<{ id: string }>(
            `INSERT INTO soi.purchase_order_items (
               purchase_order_id,
               product_id,
               quantity,
               unit_cost,
               freight_allocated,
               extra_cost_allocated,
               total_cost,
               real_unit_cost
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id;`,
            [
              purchaseId,
              item.productId,
              item.quantity,
              item.unitCost,
              item.freightAllocated,
              item.extraCostAllocated,
              calculated.totalCost,
              calculated.realUnitCost,
            ],
          );

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
             VALUES ($1, 'purchase_in', $2, $3, $4, 'purchase_order_item', $5, $6, $7);`,
            [
              item.productId,
              payload.purchaseDate,
              item.quantity,
              calculated.realUnitCost,
              itemInsert.rows[0].id,
              `Entrada por compra ${payload.purchaseNumber}`,
              currentUser?.id ?? null,
            ],
          );

          affectedProducts.add(item.productId);
        }

        await client.query(
          `UPDATE soi.purchase_orders
           SET total_amount = $1
           WHERE id = $2;`,
          [totalAmount.toFixed(2), purchaseId],
        );

        await this.refreshProductCostSnapshots(
          client,
          [...affectedProducts],
        );

        await this.financialService.syncPayableForPurchase(
          client,
          purchaseId,
          currentUser,
        );

        await client.query('COMMIT');

        return this.getPurchaseById(purchaseId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async updatePurchase(purchaseId: string, body: Record<string, unknown>) {
    const patch = this.parseUpdatePayload(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'PATCH de compra está restrito ao cabeçalho: purchaseNumber, supplierId e notes',
      );
    }

    if (patch.purchaseNumber !== undefined) {
      await this.ensurePurchaseNumberAvailable(patch.purchaseNumber, purchaseId);
    }

    if (patch.supplierId !== undefined) {
      await this.ensureSupplierExists(patch.supplierId);
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const existingPurchase = await client.query<{ id: string }>(
          `SELECT id
           FROM soi.purchase_orders
           WHERE id = $1
           LIMIT 1
           FOR UPDATE;`,
          [purchaseId],
        );

        if (!existingPurchase.rows[0]) {
          throw new NotFoundException('Compra não encontrada');
        }

        const assignments: string[] = [];
        const params: unknown[] = [];

        if (patch.purchaseNumber !== undefined) {
          params.push(patch.purchaseNumber);
          assignments.push(`purchase_number = $${params.length}`);
        }

        if (patch.supplierId !== undefined) {
          params.push(patch.supplierId);
          assignments.push(`supplier_id = $${params.length}`);
        }

        if (patch.notes !== undefined) {
          params.push(patch.notes);
          assignments.push(`notes = $${params.length}`);
        }

        params.push(purchaseId);

        await client.query(
          `UPDATE soi.purchase_orders
           SET ${assignments.join(', ')}
           WHERE id = $${params.length};`,
          params,
        );

        await this.financialService.syncPayableForPurchase(client, purchaseId);

        await client.query('COMMIT');
        return this.getPurchaseById(purchaseId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  private async listSuppliers() {
    const result = await this.db.query<SupplierRow>(
      `SELECT
         s.id,
         s.supplier_code AS "supplierCode",
         s.name,
         s.is_active AS "isActive"
       FROM soi.suppliers AS s
       WHERE s.is_active = true
       ORDER BY s.name ASC;`,
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
         p.base_unit_cost::text AS "baseUnitCost",
         p.is_active AS "isActive"
       FROM soi.products AS p
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       WHERE p.is_active = true
       ORDER BY p.name ASC, p.sku ASC;`,
    );

    return result.rows;
  }

  private async ensureSupplierExists(supplierId: string | null | undefined) {
    if (!supplierId) {
      return;
    }

    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM soi.suppliers
         WHERE id = $1
       ) AS exists;`,
      [supplierId],
    );

    if (!result.rows[0]?.exists) {
      throw new NotFoundException('Fornecedor não encontrado');
    }
  }

  private async ensureProductsExist(productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];

    const result = await this.db.query<{ id: string }>(
      `SELECT id
       FROM soi.products
       WHERE id = ANY($1::uuid[]);`,
      [uniqueIds],
    );

    if (result.rows.length !== uniqueIds.length) {
      throw new NotFoundException('Um ou mais produtos da compra não foram encontrados');
    }
  }

  private async ensurePurchaseNumberAvailable(
    purchaseNumber: string,
    purchaseId?: string,
  ) {
    const params: unknown[] = [purchaseNumber];
    let whereExclusion = '';

    if (purchaseId) {
      params.push(purchaseId);
      whereExclusion = `AND id <> $${params.length}`;
    }

    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM soi.purchase_orders
         WHERE purchase_number = $1
         ${whereExclusion}
       ) AS exists;`,
      params,
    );

    if (result.rows[0]?.exists) {
      throw new ConflictException('purchaseNumber já está em uso');
    }
  }

  private calculateItemCosts(item: PurchaseItemPayload) {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const freightAllocated = Number(item.freightAllocated);
    const extraCostAllocated = Number(item.extraCostAllocated);
    const totalCost =
      unitCost * quantity + freightAllocated + extraCostAllocated;
    const realUnitCost = totalCost / quantity;

    return {
      totalCost: totalCost.toFixed(2),
      realUnitCost: realUnitCost.toFixed(2),
    };
  }

  private async refreshProductCostSnapshots(
    client: PoolClient,
    productIds: string[],
  ) {
    if (productIds.length === 0) {
      return;
    }

    const latestItems = await client.query<{
      productId: string;
      purchaseItemId: string;
      currentUnitCost: string;
      purchaseDate: string;
    }>(
      `SELECT DISTINCT ON (poi.product_id)
         poi.product_id AS "productId",
         poi.id AS "purchaseItemId",
         poi.real_unit_cost::text AS "currentUnitCost",
         po.purchase_date AS "purchaseDate"
       FROM soi.purchase_order_items AS poi
       INNER JOIN soi.purchase_orders AS po ON po.id = poi.purchase_order_id
       WHERE poi.product_id = ANY($1::uuid[])
       ORDER BY poi.product_id, po.purchase_date DESC, poi.created_at DESC, poi.id DESC;`,
      [productIds],
    );

    for (const row of latestItems.rows) {
      await client.query(
        `INSERT INTO soi.product_cost_snapshots (
           product_id,
           current_unit_cost,
           source_purchase_item_id,
           calculated_at
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (product_id)
         DO UPDATE SET
           current_unit_cost = EXCLUDED.current_unit_cost,
           source_purchase_item_id = EXCLUDED.source_purchase_item_id,
           calculated_at = EXCLUDED.calculated_at;`,
        [
          row.productId,
          row.currentUnitCost,
          row.purchaseItemId,
          row.purchaseDate,
        ],
      );
    }
  }

  private parseCreatePayload(body: Record<string, unknown>): PurchasePayload {
    const rawItems = Array.isArray(body.items) ? body.items : null;

    if (!rawItems || rawItems.length === 0) {
      throw new BadRequestException('items deve conter pelo menos um item');
    }

    const items = rawItems.map((item, index) =>
      this.parseItemPayload(item, `items[${index}]`),
    );

    return {
      purchaseNumber: parseRequiredText(
        body.purchaseNumber,
        'purchaseNumber',
        40,
      ).toUpperCase(),
      supplierId: parseOptionalUuid(body.supplierId, 'supplierId') ?? null,
      purchaseDate: parseRequiredPurchaseDate(body.purchaseDate, 'purchaseDate'),
      notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
      items,
    };
  }

  private parseUpdatePayload(body: Record<string, unknown>): PurchasePatch {
    const patch: PurchasePatch = {};

    const purchaseNumber = parseOptionalText(
      body.purchaseNumber,
      'purchaseNumber',
      40,
    );
    if (purchaseNumber !== undefined) {
      if (purchaseNumber === null) {
        throw new BadRequestException('purchaseNumber é obrigatório');
      }
      patch.purchaseNumber = purchaseNumber.toUpperCase();
    }

    const supplierId = parseOptionalUuid(body.supplierId, 'supplierId');
    if (supplierId !== undefined) {
      patch.supplierId = supplierId;
    }

    const notes = parseOptionalText(body.notes, 'notes', 1200);
    if (notes !== undefined) {
      patch.notes = notes;
    }

    return patch;
  }

  private parseItemPayload(
    rawItem: unknown,
    path: string,
  ): PurchaseItemPayload {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new BadRequestException(`${path} deve ser um objeto`);
    }

    const item = rawItem as Record<string, unknown>;

    return {
      productId: parseRequiredUuid(item.productId, `${path}.productId`),
      quantity: parseRequiredPositiveDecimal(item.quantity, `${path}.quantity`),
      unitCost: parseRequiredMoney(item.unitCost, `${path}.unitCost`),
      freightAllocated:
        parseOptionalMoney(item.freightAllocated, `${path}.freightAllocated`) ??
        '0.00',
      extraCostAllocated:
        parseOptionalMoney(item.extraCostAllocated, `${path}.extraCostAllocated`) ??
        '0.00',
    };
  }
}
