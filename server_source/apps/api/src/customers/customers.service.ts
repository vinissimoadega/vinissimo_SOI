import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  parseRequiredInteractionType,
  parseOptionalInteractionPriority,
  parseOptionalInteractionStatus,
  parseBooleanInput,
  parseOptionalBoolean,
  parseOptionalEmail,
  parseOptionalText,
  parseOptionalTimestamp,
  parseOptionalUuid,
  parseRequiredText,
} from './customers.utils';
import {
  CUSTOMER_STATUSES,
  CustomerChannelRecord,
  CustomerInteractionPriority,
  CustomerInteractionRecord,
  CustomerInteractionStatus,
  CustomerInteractionType,
  CustomerListFilters,
  CustomerPreferenceRecord,
  CustomerRecord,
  CustomerStatus,
} from './customers.types';

type CustomerRow = QueryResultRow & CustomerRecord;
type CustomerPreferenceRow = QueryResultRow & CustomerPreferenceRecord;
type CustomerInteractionRow = QueryResultRow & CustomerInteractionRecord;
type ChannelRow = QueryResultRow & CustomerChannelRecord;

type CustomerPayload = {
  fullName: string;
  phone: string | null;
  email: string | null;
  acquisitionChannelId: string | null;
  notes: string | null;
  isActive: boolean;
};

type CustomerPatch = Partial<CustomerPayload>;

type CustomerPreferencePayload = {
  preferenceType: string;
  preferenceValue: string;
  source: string | null;
};

type CustomerInteractionPayload = {
  interactionType: CustomerInteractionType;
  salesOrderId: string | null;
  reason: string;
  interactionStatus: CustomerInteractionStatus;
  priority: CustomerInteractionPriority;
  scheduledFor: string | null;
  completedAt: string | null;
  notes: string | null;
  ownerUserId: string | null;
};

type MetricsSnapshot = {
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  ordersCount: number;
  totalRevenue: string;
  avgTicket: string | null;
};

@Injectable()
export class CustomersService {
  constructor(private readonly db: DatabaseService) {}

  async listCustomers(filters: CustomerListFilters) {
    const where: string[] = [];
    const params: unknown[] = [];
    const statusExpression = this.customerStatusExpression('m', 's');

    if (filters.search) {
      params.push(`%${filters.search}%`);
      const searchParamIndex = params.length;
      const normalizedPhoneDigits = filters.search.replace(/\D/g, '');

      if (normalizedPhoneDigits) {
        params.push(normalizedPhoneDigits);
      }

      where.push(
        `(
          c.full_name ILIKE $${searchParamIndex}
          OR COALESCE(c.phone, '') ILIKE $${searchParamIndex}
          OR COALESCE(c.email, '') ILIKE $${searchParamIndex}
          OR COALESCE(c.customer_code, '') ILIKE $${searchParamIndex}
          ${
            normalizedPhoneDigits
              ? `OR regexp_replace(COALESCE(c.phone, ''), '\\D', '', 'g') LIKE '%' || $${params.length} || '%'`
              : ''
          }
        )`,
      );
    }

    if (filters.customerStatus) {
      params.push(filters.customerStatus);
      where.push(`${statusExpression} = $${params.length}`);
    }

    if (filters.channelId) {
      params.push(filters.channelId);
      where.push(`c.acquisition_channel_id = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.customers AS c
       LEFT JOIN LATERAL (
         SELECT
           cm.first_purchase_at,
           cm.last_purchase_at,
           cm.orders_count,
           cm.total_revenue,
           cm.avg_ticket,
           cm.customer_status,
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
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const itemsResult = await this.db.query<CustomerRow>(
      `SELECT
         c.id,
         c.customer_code AS "customerCode",
         c.full_name AS "fullName",
         c.phone,
         c.email,
         c.acquisition_channel_id AS "acquisitionChannelId",
         ch.channel_key AS "acquisitionChannelKey",
         ch.channel_name AS "acquisitionChannelName",
         c.notes,
         c.is_active AS "isActive",
         m.first_purchase_at AS "firstPurchaseAt",
         m.last_purchase_at AS "lastPurchaseAt",
         COALESCE(m.orders_count, 0)::int AS "ordersCount",
         COALESCE(m.total_revenue, 0)::text AS "totalRevenue",
         m.avg_ticket::text AS "avgTicket",
         ${statusExpression} AS "customerStatus",
         m.calculated_at AS "calculatedAt",
         c.created_at AS "createdAt",
         c.updated_at AS "updatedAt"
       FROM soi.customers AS c
       LEFT JOIN soi.channels AS ch ON ch.id = c.acquisition_channel_id
       LEFT JOIN LATERAL (
         SELECT
           cm.first_purchase_at,
           cm.last_purchase_at,
           cm.orders_count,
           cm.total_revenue,
           cm.avg_ticket,
           cm.customer_status,
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
       ${whereClause}
       ORDER BY c.is_active DESC, m.last_purchase_at DESC NULLS LAST, c.full_name ASC
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
        customerStatus: filters.customerStatus ?? null,
        channelId: filters.channelId ?? null,
      },
      meta: {
        channels: await this.listChannels(),
        availableStatuses: [...CUSTOMER_STATUSES],
      },
    };
  }

  async getCustomerById(customerId: string) {
    const result = await this.db.query<CustomerRow>(
      `SELECT
         c.id,
         c.customer_code AS "customerCode",
         c.full_name AS "fullName",
         c.phone,
         c.email,
         c.acquisition_channel_id AS "acquisitionChannelId",
         ch.channel_key AS "acquisitionChannelKey",
         ch.channel_name AS "acquisitionChannelName",
         c.notes,
         c.is_active AS "isActive",
         m.first_purchase_at AS "firstPurchaseAt",
         m.last_purchase_at AS "lastPurchaseAt",
         COALESCE(m.orders_count, 0)::int AS "ordersCount",
         COALESCE(m.total_revenue, 0)::text AS "totalRevenue",
         m.avg_ticket::text AS "avgTicket",
         ${this.customerStatusExpression('m', 's')} AS "customerStatus",
         m.calculated_at AS "calculatedAt",
         c.created_at AS "createdAt",
         c.updated_at AS "updatedAt"
       FROM soi.customers AS c
       LEFT JOIN soi.channels AS ch ON ch.id = c.acquisition_channel_id
       LEFT JOIN LATERAL (
         SELECT
           cm.first_purchase_at,
           cm.last_purchase_at,
           cm.orders_count,
           cm.total_revenue,
           cm.avg_ticket,
           cm.customer_status,
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
       WHERE c.id = $1
       LIMIT 1;`,
      [customerId],
    );

    const customer = result.rows[0];

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    return customer;
  }

  async createCustomer(body: Record<string, unknown>) {
    const payload = this.parseCreatePayload(body);

    await this.ensureChannelExists(payload.acquisitionChannelId);

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const customerCode = await this.generateNextCustomerCode(client);
        const insertResult = await client.query<{ id: string }>(
          `INSERT INTO soi.customers (
             customer_code,
             full_name,
             phone,
             email,
             acquisition_channel_id,
             notes,
             is_active
           )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id;`,
          [
            customerCode,
            payload.fullName,
            payload.phone,
            payload.email,
            payload.acquisitionChannelId,
            payload.notes,
            payload.isActive,
          ],
        );

        await this.upsertCustomerMetrics(client, insertResult.rows[0].id, {
          firstPurchaseAt: null,
          lastPurchaseAt: null,
          ordersCount: 0,
          totalRevenue: '0.00',
          avgTicket: null,
        });

        await client.query('COMMIT');

        return this.getCustomerById(insertResult.rows[0].id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async updateCustomer(customerId: string, body: Record<string, unknown>) {
    const current = await this.getCustomerById(customerId);
    const patch = this.parseUpdatePayload(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nenhum campo válido foi enviado para atualização');
    }

    if (patch.acquisitionChannelId !== undefined) {
      await this.ensureChannelExists(patch.acquisitionChannelId);
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const assignments: string[] = [];
        const values: unknown[] = [];

        const pushAssignment = (column: string, value: unknown) => {
          values.push(value);
          assignments.push(`${column} = $${values.length}`);
        };

        if (patch.fullName !== undefined) {
          pushAssignment('full_name', patch.fullName);
        }

        if (patch.phone !== undefined) {
          pushAssignment('phone', patch.phone);
        }

        if (patch.email !== undefined) {
          pushAssignment('email', patch.email);
        }

        if (patch.acquisitionChannelId !== undefined) {
          pushAssignment('acquisition_channel_id', patch.acquisitionChannelId);
        }

        if (patch.notes !== undefined) {
          pushAssignment('notes', patch.notes);
        }

        if (patch.isActive !== undefined) {
          pushAssignment('is_active', patch.isActive);
        }

        if (assignments.length > 0) {
          values.push(customerId);
          await client.query(
            `UPDATE soi.customers
             SET ${assignments.join(', ')}, updated_at = NOW()
             WHERE id = $${values.length};`,
            values,
          );
        }

        await this.upsertCustomerMetrics(client, customerId, {
          firstPurchaseAt: current.firstPurchaseAt,
          lastPurchaseAt: current.lastPurchaseAt,
          ordersCount: current.ordersCount,
          totalRevenue: current.totalRevenue,
          avgTicket: current.avgTicket,
        });

        await client.query('COMMIT');

        return this.getCustomerById(customerId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async listCustomerPreferences(customerId: string) {
    await this.getCustomerById(customerId);

    const result = await this.db.query<CustomerPreferenceRow>(
      `SELECT
         cp.id,
         cp.customer_id AS "customerId",
         cp.preference_type AS "preferenceType",
         cp.preference_value AS "preferenceValue",
         cp.source,
         cp.created_at AS "createdAt"
       FROM soi.customer_preferences AS cp
       WHERE cp.customer_id = $1
       ORDER BY cp.created_at DESC, cp.preference_type ASC;`,
      [customerId],
    );

    return {
      customerId,
      items: result.rows,
    };
  }

  async createCustomerPreference(customerId: string, body: Record<string, unknown>) {
    await this.getCustomerById(customerId);
    const payload = this.parsePreferencePayload(body);

    const insertResult = await this.db.query<{ id: string }>(
      `INSERT INTO soi.customer_preferences (
         customer_id,
         preference_type,
         preference_value,
         source
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id;`,
      [
        customerId,
        payload.preferenceType,
        payload.preferenceValue,
        payload.source,
      ],
    );

    const result = await this.db.query<CustomerPreferenceRow>(
      `SELECT
         cp.id,
         cp.customer_id AS "customerId",
         cp.preference_type AS "preferenceType",
         cp.preference_value AS "preferenceValue",
         cp.source,
         cp.created_at AS "createdAt"
       FROM soi.customer_preferences AS cp
       WHERE cp.id = $1
       LIMIT 1;`,
      [insertResult.rows[0].id],
    );

    return result.rows[0];
  }

  async listCustomerInteractions(customerId: string) {
    await this.getCustomerById(customerId);

    const result = await this.db.query<CustomerInteractionRow>(
      `SELECT
         ci.id,
         ci.customer_id AS "customerId",
         ci.interaction_type AS "interactionType",
         ci.sales_order_id AS "salesOrderId",
         so.sale_number AS "saleNumber",
         ci.reason,
         ci.interaction_status AS "interactionStatus",
         ci.priority,
         ci.scheduled_for AS "scheduledFor",
         ci.completed_at AS "completedAt",
         ci.notes,
         ci.owner_user_id AS "ownerUserId",
         u.full_name AS "ownerUserName",
         ci.created_at AS "createdAt",
         ci.updated_at AS "updatedAt"
       FROM soi.customer_interactions AS ci
       LEFT JOIN soi.sales_orders AS so ON so.id = ci.sales_order_id
       LEFT JOIN soi.users AS u ON u.id = ci.owner_user_id
       WHERE ci.customer_id = $1
       ORDER BY
         CASE ci.interaction_status
           WHEN 'pending' THEN 0
           WHEN 'attempt_open' THEN 1
           ELSE 2
         END,
         ci.scheduled_for ASC NULLS LAST,
         ci.updated_at DESC,
         ci.created_at DESC;`,
      [customerId],
    );

    return {
      customerId,
      items: result.rows,
    };
  }

  async createCustomerInteraction(
    customerId: string,
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    await this.getCustomerById(customerId);
    const payload = this.parseInteractionPayload(body, currentUser?.id ?? null);

    if (payload.ownerUserId) {
      await this.ensureUserExists(payload.ownerUserId);
    }

    if (payload.salesOrderId) {
      await this.ensureSalesOrderBelongsToCustomer(payload.salesOrderId, customerId);
    }

    const insertResult = await this.db.query<{ id: string }>(
      `INSERT INTO soi.customer_interactions (
         customer_id,
         interaction_type,
         sales_order_id,
         reason,
         interaction_status,
         priority,
         scheduled_for,
         completed_at,
         notes,
         owner_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id;`,
      [
        customerId,
        payload.interactionType,
        payload.salesOrderId,
        payload.reason,
        payload.interactionStatus,
        payload.priority,
        payload.scheduledFor,
        payload.completedAt,
        payload.notes,
        payload.ownerUserId,
      ],
    );

    const result = await this.db.query<CustomerInteractionRow>(
      `SELECT
         ci.id,
         ci.customer_id AS "customerId",
         ci.interaction_type AS "interactionType",
         ci.sales_order_id AS "salesOrderId",
         so.sale_number AS "saleNumber",
         ci.reason,
         ci.interaction_status AS "interactionStatus",
         ci.priority,
         ci.scheduled_for AS "scheduledFor",
         ci.completed_at AS "completedAt",
         ci.notes,
         ci.owner_user_id AS "ownerUserId",
         u.full_name AS "ownerUserName",
         ci.created_at AS "createdAt",
         ci.updated_at AS "updatedAt"
       FROM soi.customer_interactions AS ci
       LEFT JOIN soi.sales_orders AS so ON so.id = ci.sales_order_id
       LEFT JOIN soi.users AS u ON u.id = ci.owner_user_id
       WHERE ci.id = $1
       LIMIT 1;`,
      [insertResult.rows[0].id],
    );

    return result.rows[0];
  }

  private async listChannels() {
    const result = await this.db.query<ChannelRow>(
      `SELECT
         ch.id,
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         ch.is_active AS "isActive"
       FROM soi.channels AS ch
       ORDER BY ch.channel_name ASC;`,
    );

    return result.rows;
  }

  private async ensureChannelExists(channelId: string | null | undefined) {
    if (!channelId) {
      return;
    }

    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM soi.channels WHERE id = $1) AS exists;',
      [channelId],
    );

    if (!result.rows[0]?.exists) {
      throw new NotFoundException('Canal de aquisição não encontrado');
    }
  }

  private async ensureUserExists(userId: string) {
    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM soi.users WHERE id = $1) AS exists;',
      [userId],
    );

    if (!result.rows[0]?.exists) {
      throw new NotFoundException('Usuário responsável não encontrado');
    }
  }

  private async ensureSalesOrderBelongsToCustomer(
    salesOrderId: string,
    customerId: string,
  ) {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1
         FROM soi.sales_orders AS so
         WHERE so.id = $1
           AND so.customer_id = $2
       ) AS exists;`,
      [salesOrderId, customerId],
    );

    if (!result.rows[0]?.exists) {
      throw new NotFoundException('Pedido vinculado não encontrado para este cliente');
    }
  }

  private async upsertCustomerMetrics(
    client: PoolClient,
    customerId: string,
    metrics: MetricsSnapshot,
  ) {
    const inactiveDays = await this.getCurrentInactiveDays(client);
    const derivedStatus = this.deriveCustomerStatus(metrics, inactiveDays);
    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM soi.customer_metrics
       WHERE customer_id = $1
       ORDER BY calculated_at DESC
       LIMIT 1;`,
      [customerId],
    );

    if (existing.rows[0]) {
      await client.query(
        `UPDATE soi.customer_metrics
         SET
           first_purchase_at = $1,
           last_purchase_at = $2,
           orders_count = $3,
           total_revenue = $4,
           avg_ticket = $5,
           customer_status = $6,
           calculated_at = NOW()
         WHERE id = $7;`,
        [
          metrics.firstPurchaseAt,
          metrics.lastPurchaseAt,
          metrics.ordersCount,
          metrics.totalRevenue,
          metrics.avgTicket,
          derivedStatus,
          existing.rows[0].id,
        ],
      );
      return;
    }

    await client.query(
      `INSERT INTO soi.customer_metrics (
         customer_id,
         first_purchase_at,
         last_purchase_at,
         orders_count,
         total_revenue,
         avg_ticket,
         customer_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        customerId,
        metrics.firstPurchaseAt,
        metrics.lastPurchaseAt,
        metrics.ordersCount,
        metrics.totalRevenue,
        metrics.avgTicket,
        derivedStatus,
      ],
    );
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

  private async getCurrentInactiveDays(client: PoolClient) {
    const result = await client.query<{ customerInactiveDays: number | null }>(
      `SELECT
         ss.customer_inactive_days AS "customerInactiveDays"
       FROM soi.system_settings AS ss
       WHERE ss.is_current = true
       ORDER BY ss.effective_from DESC
       LIMIT 1;`,
    );

    return Number(result.rows[0]?.customerInactiveDays ?? 45);
  }

  private deriveCustomerStatus(
    metrics: Pick<MetricsSnapshot, 'ordersCount' | 'lastPurchaseAt'>,
    inactiveDays: number,
  ): CustomerStatus {
    const ordersCount = Number(metrics.ordersCount ?? 0);

    if (ordersCount <= 0) {
      return 'lead';
    }

    const normalizedInactiveDays =
      Number.isFinite(inactiveDays) && inactiveDays > 0 ? inactiveDays : 45;

    if (metrics.lastPurchaseAt) {
      const lastPurchaseAt = new Date(metrics.lastPurchaseAt);
      const inactivityThreshold = new Date(
        Date.now() - normalizedInactiveDays * 24 * 60 * 60 * 1000,
      );

      if (!Number.isNaN(lastPurchaseAt.getTime()) && lastPurchaseAt < inactivityThreshold) {
        return 'inativo';
      }
    }

    return ordersCount === 1 ? 'novo' : 'recorrente';
  }

  private parseCreatePayload(body: Record<string, unknown>): CustomerPayload {
    return {
      fullName: parseRequiredText(body.fullName, 'fullName', 160),
      phone: parseOptionalText(body.phone, 'phone', 40) ?? null,
      email: parseOptionalEmail(body.email, 'email') ?? null,
      acquisitionChannelId:
        parseOptionalUuid(body.acquisitionChannelId, 'acquisitionChannelId') ?? null,
      notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
      isActive: parseOptionalBoolean(body.isActive, 'isActive') ?? true,
    };
  }

  private parseUpdatePayload(body: Record<string, unknown>): CustomerPatch {
    const patch: CustomerPatch = {};

    const fullName = parseOptionalText(body.fullName, 'fullName', 160);
    if (fullName !== undefined) {
      if (fullName === null) {
        throw new BadRequestException('fullName é obrigatório');
      }
      patch.fullName = fullName;
    }

    const phone = parseOptionalText(body.phone, 'phone', 40);
    if (phone !== undefined) {
      patch.phone = phone;
    }

    const email = parseOptionalEmail(body.email, 'email');
    if (email !== undefined) {
      patch.email = email;
    }

    const acquisitionChannelId = parseOptionalUuid(
      body.acquisitionChannelId,
      'acquisitionChannelId',
    );
    if (acquisitionChannelId !== undefined) {
      patch.acquisitionChannelId = acquisitionChannelId;
    }

    const notes = parseOptionalText(body.notes, 'notes', 1200);
    if (notes !== undefined) {
      patch.notes = notes;
    }

    const isActive = parseOptionalBoolean(body.isActive, 'isActive');
    if (isActive !== undefined) {
      patch.isActive = isActive ?? false;
    }

    return patch;
  }

  private parsePreferencePayload(
    body: Record<string, unknown>,
  ): CustomerPreferencePayload {
    return {
      preferenceType: parseRequiredText(body.preferenceType, 'preferenceType', 80),
      preferenceValue: parseRequiredText(body.preferenceValue, 'preferenceValue', 240),
      source: parseOptionalText(body.source, 'source', 80) ?? null,
    };
  }

  private parseInteractionPayload(
    body: Record<string, unknown>,
    defaultOwnerUserId: string | null,
  ): CustomerInteractionPayload {
    const scheduledFor = parseOptionalTimestamp(body.scheduledFor, 'scheduledFor');
    const completedAt = parseOptionalTimestamp(body.completedAt, 'completedAt');
    const interactionStatus =
      parseOptionalInteractionStatus(
        body.interactionStatus,
        'interactionStatus',
      ) ??
      (completedAt ? 'done' : 'pending');

    if (scheduledFor && completedAt && new Date(completedAt) < new Date(scheduledFor)) {
      throw new BadRequestException(
        'completedAt não pode ser anterior a scheduledFor',
      );
    }

    return {
      interactionType: parseRequiredInteractionType(
        body.interactionType,
        'interactionType',
      ),
      salesOrderId:
        parseOptionalUuid(body.salesOrderId, 'salesOrderId') ?? null,
      reason:
        parseOptionalText(body.reason, 'reason', 240) ??
        parseOptionalText(body.notes, 'notes', 1500) ??
        'Interação operacional',
      interactionStatus,
      priority:
        parseOptionalInteractionPriority(body.priority, 'priority') ?? 'medium',
      scheduledFor: scheduledFor ?? null,
      completedAt: completedAt ?? null,
      notes: parseOptionalText(body.notes, 'notes', 1500) ?? null,
      ownerUserId:
        parseOptionalUuid(body.ownerUserId, 'ownerUserId') ?? defaultOwnerUserId ?? null,
    };
  }

  private async generateNextCustomerCode(client: PoolClient) {
    await client.query(`SELECT pg_advisory_xact_lock(2501001);`);

    const result = await client.query<{ lastNumber: number }>(
      `SELECT
         COALESCE(MAX(((regexp_match(customer_code, '^CLI-(\\d{6})$'))[1])::int), 0) AS "lastNumber"
       FROM soi.customers
       WHERE customer_code ~ '^CLI-(\\d{6})$';`,
    );

    const nextNumber = Number(result.rows[0]?.lastNumber ?? 0) + 1;
    return `CLI-${String(nextNumber).padStart(6, '0')}`;
  }
}
