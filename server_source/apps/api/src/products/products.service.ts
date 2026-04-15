import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  parseBooleanInput,
  parseOptionalBoolean,
  parseOptionalDecimal,
  parseOptionalText,
  parseOptionalUuid,
  parseRequiredText,
  parseRequiredUuid,
  parseSku,
  slugify,
} from './products.utils';
import {
  ProductCategoryRecord,
  ProductChannelPriceRecord,
  ProductListFilters,
  ProductRecord,
  ProductSkuLookupRecord,
} from './products.types';

type ProductRow = QueryResultRow &
  ProductRecord & {
    categoryName: string | null;
    categorySlug: string | null;
  };

type CategoryRow = QueryResultRow & ProductCategoryRecord;

type ChannelPriceRow = QueryResultRow & ProductChannelPriceRecord;
type ProductSkuLookupRow = QueryResultRow & ProductSkuLookupRecord;

type ProductPayload = {
  sku: string;
  name: string;
  categoryId: string | null;
  countryName: string | null;
  regionName: string | null;
  grapeComposition: string | null;
  wineDescription: string | null;
  baseUnitCost: string | null;
  initialStockQty: string | null;
  minStockManualQty: string | null;
  isActive: boolean;
  notes: string | null;
};

type ProductPatch = Partial<ProductPayload>;

type ChannelPriceInput = {
  channelId: string;
  targetPrice: string | null;
};

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  async listProducts(filters: ProductListFilters) {
    const where: string[] = [];
    const params: unknown[] = [];
    let exactSkuParamIndex: number | null = null;
    let searchParamIndex: number | null = null;

    if (filters.search) {
      params.push(filters.search.toUpperCase());
      exactSkuParamIndex = params.length;
      params.push(`%${filters.search}%`);
      searchParamIndex = params.length;
      where.push(`(
        p.sku = $${exactSkuParamIndex}
        OR p.sku ILIKE $${searchParamIndex}
        OR p.name ILIKE $${searchParamIndex}
        OR COALESCE(p.country_name, '') ILIKE $${searchParamIndex}
        OR COALESCE(p.region_name, '') ILIKE $${searchParamIndex}
        OR COALESCE(p.grape_composition, '') ILIKE $${searchParamIndex}
        OR COALESCE(p.wine_description, '') ILIKE $${searchParamIndex}
        OR COALESCE(p.notes, '') ILIKE $${searchParamIndex}
      )`);
    }

    if (filters.categoryId) {
      params.push(filters.categoryId);
      where.push(`p.category_id = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      where.push(`p.is_active = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.products AS p
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const searchRanking =
      exactSkuParamIndex && searchParamIndex
        ? `CASE
             WHEN p.sku = $${exactSkuParamIndex} THEN 0
             WHEN p.sku ILIKE $${searchParamIndex} THEN 1
             WHEN p.name ILIKE $${searchParamIndex} THEN 2
             WHEN COALESCE(p.country_name, '') ILIKE $${searchParamIndex} THEN 3
             WHEN COALESCE(p.region_name, '') ILIKE $${searchParamIndex} THEN 4
             WHEN COALESCE(p.grape_composition, '') ILIKE $${searchParamIndex} THEN 5
             WHEN COALESCE(p.wine_description, '') ILIKE $${searchParamIndex} THEN 6
             ELSE 7
           END,`
        : '';

    const itemsResult = await this.db.query<ProductRow>(
      `SELECT
         p.id,
         p.sku,
         p.name,
         p.category_id AS "categoryId",
         c.name AS "categoryName",
         c.slug AS "categorySlug",
         p.country_name AS "countryName",
         p.region_name AS "regionName",
         p.grape_composition AS "grapeComposition",
         p.wine_description AS "wineDescription",
         p.base_unit_cost::text AS "baseUnitCost",
         pcs.current_unit_cost::text AS "currentUnitCost",
         p.initial_stock_qty::text AS "initialStockQty",
         p.min_stock_manual_qty::text AS "minStockManualQty",
         p.is_active AS "isActive",
         p.notes,
         COALESCE(price_counts.channel_prices_count, 0)::int AS "channelPricesCount",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt"
       FROM soi.products AS p
       LEFT JOIN soi.product_categories AS c ON c.id = p.category_id
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       LEFT JOIN (
         SELECT product_id, COUNT(*)::int AS channel_prices_count
         FROM soi.product_channel_prices
         GROUP BY product_id
       ) AS price_counts ON price_counts.product_id = p.id
       ${whereClause}
       ORDER BY ${searchRanking} p.is_active DESC, p.name ASC, p.sku ASC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

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
        isActive: filters.isActive ?? null,
      },
    };
  }

  async getProductById(productId: string) {
    const result = await this.db.query<ProductRow>(
      `SELECT
         p.id,
         p.sku,
         p.name,
         p.category_id AS "categoryId",
         c.name AS "categoryName",
         c.slug AS "categorySlug",
         p.country_name AS "countryName",
         p.region_name AS "regionName",
         p.grape_composition AS "grapeComposition",
         p.wine_description AS "wineDescription",
         p.base_unit_cost::text AS "baseUnitCost",
         pcs.current_unit_cost::text AS "currentUnitCost",
         p.initial_stock_qty::text AS "initialStockQty",
         p.min_stock_manual_qty::text AS "minStockManualQty",
         p.is_active AS "isActive",
         p.notes,
         COALESCE(price_counts.channel_prices_count, 0)::int AS "channelPricesCount",
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt"
       FROM soi.products AS p
       LEFT JOIN soi.product_categories AS c ON c.id = p.category_id
       LEFT JOIN soi.product_cost_snapshots AS pcs ON pcs.product_id = p.id
       LEFT JOIN (
         SELECT product_id, COUNT(*)::int AS channel_prices_count
         FROM soi.product_channel_prices
         GROUP BY product_id
       ) AS price_counts ON price_counts.product_id = p.id
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

  async lookupProductBySku(rawSku: string | undefined) {
    const sku = parseSku(rawSku);
    const result = await this.db.query<ProductSkuLookupRow>(
      `SELECT
         p.id,
         p.sku,
         p.name,
         p.is_active AS "isActive",
         p.country_name AS "countryName",
         p.region_name AS "regionName",
         p.grape_composition AS "grapeComposition",
         pcs.current_unit_cost::text AS "currentUnitCost",
         COALESCE(stock.current_stock_qty, 0)::text AS "currentStockQty"
       FROM soi.products AS p
       LEFT JOIN soi.product_cost_snapshots AS pcs
         ON pcs.product_id = p.id
       LEFT JOIN (
         SELECT
           product_id,
           COALESCE(SUM(quantity_delta), 0)::numeric(14, 2) AS current_stock_qty
         FROM soi.inventory_movements
         GROUP BY product_id
       ) AS stock
         ON stock.product_id = p.id
       WHERE p.sku = $1
       LIMIT 1;`,
      [sku],
    );

    return {
      sku,
      found: (result.rowCount ?? 0) > 0,
      product: result.rows[0] ?? null,
    };
  }

  async createProduct(body: Record<string, unknown>) {
    const payload = this.parseCreatePayload(body);

    await this.ensureSkuAvailable(payload.sku);
    await this.ensureCategoryExists(payload.categoryId);

    const insertResult = await this.db.query<{ id: string }>(
      `INSERT INTO soi.products (
         sku,
         name,
         category_id,
         country_name,
         region_name,
         grape_composition,
         wine_description,
         base_unit_cost,
         initial_stock_qty,
         min_stock_manual_qty,
         is_active,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id;`,
      [
        payload.sku,
        payload.name,
        payload.categoryId,
        payload.countryName,
        payload.regionName,
        payload.grapeComposition,
        payload.wineDescription,
        payload.baseUnitCost,
        payload.initialStockQty,
        payload.minStockManualQty,
        payload.isActive,
        payload.notes,
      ],
    );

    return this.getProductById(insertResult.rows[0].id);
  }

  async updateProduct(productId: string, body: Record<string, unknown>) {
    await this.getProductById(productId);

    const patch = this.parseUpdatePayload(body);
    const updates: string[] = [];
    const params: unknown[] = [];

    if (patch.sku !== undefined) {
      await this.ensureSkuAvailable(patch.sku, productId);
      params.push(patch.sku);
      updates.push(`sku = $${params.length}`);
    }

    if (patch.name !== undefined) {
      params.push(patch.name);
      updates.push(`name = $${params.length}`);
    }

    if (patch.categoryId !== undefined) {
      await this.ensureCategoryExists(patch.categoryId);
      params.push(patch.categoryId);
      updates.push(`category_id = $${params.length}`);
    }

    if (patch.countryName !== undefined) {
      params.push(patch.countryName);
      updates.push(`country_name = $${params.length}`);
    }

    if (patch.regionName !== undefined) {
      params.push(patch.regionName);
      updates.push(`region_name = $${params.length}`);
    }

    if (patch.grapeComposition !== undefined) {
      params.push(patch.grapeComposition);
      updates.push(`grape_composition = $${params.length}`);
    }

    if (patch.wineDescription !== undefined) {
      params.push(patch.wineDescription);
      updates.push(`wine_description = $${params.length}`);
    }

    if (patch.baseUnitCost !== undefined) {
      params.push(patch.baseUnitCost);
      updates.push(`base_unit_cost = $${params.length}`);
    }

    if (patch.initialStockQty !== undefined) {
      params.push(patch.initialStockQty);
      updates.push(`initial_stock_qty = $${params.length}`);
    }

    if (patch.minStockManualQty !== undefined) {
      params.push(patch.minStockManualQty);
      updates.push(`min_stock_manual_qty = $${params.length}`);
    }

    if (patch.isActive !== undefined) {
      params.push(patch.isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (patch.notes !== undefined) {
      params.push(patch.notes);
      updates.push(`notes = $${params.length}`);
    }

    if (updates.length === 0) {
      throw new BadRequestException('Nenhum campo válido foi enviado para atualização');
    }

    params.push(productId);

    await this.db.query(
      `UPDATE soi.products
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length};`,
      params,
    );

    return this.getProductById(productId);
  }

  async listCategories() {
    const result = await this.db.query<CategoryRow>(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.is_active AS "isActive",
         COUNT(p.id)::int AS "productCount",
         c.created_at AS "createdAt"
       FROM soi.product_categories AS c
       LEFT JOIN soi.products AS p ON p.category_id = c.id
       GROUP BY c.id, c.name, c.slug, c.is_active, c.created_at
       ORDER BY c.is_active DESC, c.name ASC;`,
    );

    return {
      items: result.rows,
    };
  }

  async createCategory(body: Record<string, unknown>) {
    const name = parseRequiredText(body.name, 'name', 100);
    const isActive = body.isActive === undefined ? true : parseBooleanInput(body.isActive, 'isActive');
    const providedSlug = parseOptionalText(body.slug, 'slug', 100);
    const slug = slugify(providedSlug || name);

    if (!slug) {
      throw new BadRequestException('slug inválido');
    }

    await this.ensureCategorySlugAvailable(slug);

    const result = await this.db.query<CategoryRow>(
      `INSERT INTO soi.product_categories (name, slug, is_active)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         name,
         slug,
         is_active AS "isActive",
         0::int AS "productCount",
         created_at AS "createdAt";`,
      [name, slug, isActive],
    );

    return result.rows[0];
  }

  async getProductChannelPrices(productId: string) {
    await this.getProductById(productId);

    const result = await this.db.query<ChannelPriceRow>(
      `SELECT
         pcp.id AS "priceId",
         c.id AS "channelId",
         c.channel_key AS "channelKey",
         c.channel_name AS "channelName",
         c.is_active AS "isActive",
         pcp.target_price::text AS "targetPrice",
         pcp.updated_at AS "updatedAt"
       FROM soi.channels AS c
       LEFT JOIN soi.product_channel_prices AS pcp
         ON pcp.channel_id = c.id
        AND pcp.product_id = $1
       ORDER BY c.is_active DESC, c.channel_name ASC;`,
      [productId],
    );

    return {
      productId,
      prices: result.rows,
    };
  }

  async replaceProductChannelPrices(productId: string, body: Record<string, unknown>) {
    await this.getProductById(productId);

    const prices = this.parseChannelPrices(body);

    if (prices.length > 0) {
      const validChannels = await this.db.query<{ id: string }>(
        'SELECT id FROM soi.channels WHERE id = ANY($1::uuid[]);',
        [prices.map((entry) => entry.channelId)],
      );

      if (validChannels.rowCount !== prices.length) {
        throw new BadRequestException('Um ou mais canais enviados são inválidos');
      }
    }

    await this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        await client.query(
          'DELETE FROM soi.product_channel_prices WHERE product_id = $1;',
          [productId],
        );

        for (const price of prices) {
          if (price.targetPrice === null) {
            continue;
          }

          await client.query(
            `INSERT INTO soi.product_channel_prices (product_id, channel_id, target_price)
             VALUES ($1, $2, $3);`,
            [productId, price.channelId, price.targetPrice],
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    return this.getProductChannelPrices(productId);
  }

  private parseCreatePayload(body: Record<string, unknown>): ProductPayload {
    return {
      sku: parseSku(body.sku),
      name: parseRequiredText(body.name, 'name', 180),
      categoryId: parseOptionalUuid(body.categoryId, 'categoryId') ?? null,
      countryName: parseOptionalText(body.countryName, 'countryName', 100) ?? null,
      regionName: parseOptionalText(body.regionName, 'regionName', 140) ?? null,
      grapeComposition:
        parseOptionalText(body.grapeComposition, 'grapeComposition', 240) ?? null,
      wineDescription:
        parseOptionalText(body.wineDescription, 'wineDescription', 4000) ?? null,
      baseUnitCost: parseOptionalDecimal(body.baseUnitCost, 'baseUnitCost') ?? null,
      initialStockQty:
        parseOptionalDecimal(body.initialStockQty, 'initialStockQty') ?? '0.00',
      minStockManualQty:
        parseOptionalDecimal(body.minStockManualQty, 'minStockManualQty') ?? null,
      isActive: body.isActive === undefined ? true : parseBooleanInput(body.isActive, 'isActive'),
      notes: parseOptionalText(body.notes, 'notes', 5000) ?? null,
    };
  }

  private parseUpdatePayload(body: Record<string, unknown>): ProductPatch {
    return {
      sku: body.sku === undefined ? undefined : parseSku(body.sku),
      name:
        body.name === undefined
          ? undefined
          : parseRequiredText(body.name, 'name', 180),
      categoryId: parseOptionalUuid(body.categoryId, 'categoryId'),
      countryName: parseOptionalText(body.countryName, 'countryName', 100),
      regionName: parseOptionalText(body.regionName, 'regionName', 140),
      grapeComposition: parseOptionalText(
        body.grapeComposition,
        'grapeComposition',
        240,
      ),
      wineDescription: parseOptionalText(
        body.wineDescription,
        'wineDescription',
        4000,
      ),
      baseUnitCost: parseOptionalDecimal(body.baseUnitCost, 'baseUnitCost'),
      initialStockQty: parseOptionalDecimal(body.initialStockQty, 'initialStockQty'),
      minStockManualQty: parseOptionalDecimal(
        body.minStockManualQty,
        'minStockManualQty',
      ),
      isActive:
        body.isActive === undefined
          ? undefined
          : parseBooleanInput(body.isActive, 'isActive'),
      notes: parseOptionalText(body.notes, 'notes', 5000),
    };
  }

  private parseChannelPrices(body: Record<string, unknown>): ChannelPriceInput[] {
    if (!Array.isArray(body.prices)) {
      throw new BadRequestException('prices deve ser um array');
    }

    const seen = new Set<string>();

    return body.prices.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new BadRequestException(`prices[${index}] inválido`);
      }

      const typedEntry = entry as Record<string, unknown>;
      const channelId = parseRequiredUuid(
        typedEntry.channelId,
        `prices[${index}].channelId`,
      );

      if (seen.has(channelId)) {
        throw new BadRequestException('prices contém canais duplicados');
      }

      seen.add(channelId);

      return {
        channelId,
        targetPrice:
          parseOptionalDecimal(typedEntry.targetPrice, `prices[${index}].targetPrice`) ??
          null,
      };
    });
  }

  private async ensureSkuAvailable(sku: string, excludeProductId?: string) {
    const params: unknown[] = [sku];
    let sql = `
      SELECT
        id,
        sku,
        name,
        is_active AS "isActive"
      FROM soi.products
      WHERE sku = $1
    `;

    if (excludeProductId) {
      params.push(excludeProductId);
      sql += ` AND id <> $${params.length}`;
    }

    sql += ' LIMIT 1;';

    const result = await this.db.query<{
      id: string;
      sku: string;
      name: string;
      isActive: boolean;
    }>(sql, params);

    if (result.rowCount) {
      const existingProduct = result.rows[0];
      throw new ConflictException({
        message: `SKU ${sku} já cadastrado em "${existingProduct.name}". Abra o cadastro existente para editar este vinho.`,
        existingProductId: existingProduct.id,
        existingProductName: existingProduct.name,
        existingProductSku: existingProduct.sku,
        existingProductHref: `/products/${existingProduct.id}`,
        existingProductIsActive: existingProduct.isActive,
      });
    }
  }

  private async ensureCategoryExists(categoryId: string | null) {
    if (!categoryId) {
      return;
    }

    const result = await this.db.query<{ id: string }>(
      'SELECT id FROM soi.product_categories WHERE id = $1 LIMIT 1;',
      [categoryId],
    );

    if (!result.rowCount) {
      throw new BadRequestException('categoryId não encontrado');
    }
  }

  private async ensureCategorySlugAvailable(slug: string) {
    const result = await this.db.query<{ id: string }>(
      'SELECT id FROM soi.product_categories WHERE slug = $1 LIMIT 1;',
      [slug],
    );

    if (result.rowCount) {
      throw new ConflictException('Slug de categoria já cadastrado');
    }
  }
}
