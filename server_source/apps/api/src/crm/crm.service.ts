import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient, QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CustomerStatus } from '../customers/customers.types';
import {
  CRM_QUEUE_TASK_TYPES,
  CrmCustomerMemoryResponse,
  CrmCustomerOption,
  CrmCustomerSale,
  CrmOverviewResponse,
  CrmOverviewSummary,
  CrmQueueFilters,
  CrmQueueItem,
  CrmQueueResponse,
  CrmRecurringCustomer,
  CrmSaleOption,
  CrmSuggestedAction,
  CrmTaskStatus,
  CrmTaskType,
} from './crm.types';
import {
  isOpenCrmTaskStatus,
  parseCrmTaskCreatePayload,
  parseCrmTaskUpdatePayload,
} from './crm.utils';

type QueueRow = QueryResultRow & CrmQueueItem;
type SummaryRow = QueryResultRow & {
  totalOpenTasks: number;
  overdueTasks: number;
  customersRequiringActionCount: number;
  followupPendingCount: number;
  postSaleDueCount: number;
  reviewRequestDueCount: number;
  reactivationDueCount: number;
  manualActionDueCount: number;
  recurringCustomersCount: number;
  inactiveCustomersCount: number;
};
type CustomerOptionRow = QueryResultRow & CrmCustomerOption;
type SaleOptionRow = QueryResultRow & CrmSaleOption;
type RecurringCustomerRow = QueryResultRow & CrmRecurringCustomer;
type CustomerMemoryRow = QueryResultRow & CrmCustomerMemoryResponse['customer'];
type CustomerPreferenceRow = QueryResultRow & {
  id: string;
  preferenceType: string;
  preferenceValue: string;
  source: string | null;
};
type CustomerSaleRow = QueryResultRow & CrmCustomerSale;

const POST_SALE_DELAY_DAYS = 2;
const REVIEW_REQUEST_DELAY_DAYS = 5;

@Injectable()
export class CrmService {
  constructor(private readonly db: DatabaseService) {}

  async getOverview(): Promise<CrmOverviewResponse> {
    await this.ensureDerivedTasks();

    const [summary, queue, recurringCustomers, customers, sales] = await Promise.all([
      this.getSummary(),
      this.getQueueItems({ page: 1, pageSize: 20, onlyOpen: true }),
      this.getRecurringCustomers(),
      this.listCustomerOptions(),
      this.listSaleOptions(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      summary,
      queue,
      recurringCustomers,
      meta: {
        customers,
        sales,
      },
    };
  }

  async listQueue(filters: CrmQueueFilters): Promise<CrmQueueResponse> {
    await this.ensureDerivedTasks();

    const { items, totalItems, currentPage, totalPages } = await this.getQueueResult(
      filters,
    );

    return {
      items,
      pagination: {
        page: currentPage,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
      },
      filters: {
        taskType: filters.taskType ?? null,
        taskStatus: filters.taskStatus ?? null,
        customerId: filters.customerId ?? null,
        onlyOverdue: filters.onlyOverdue ?? null,
      },
    };
  }

  async getCustomerMemory(customerId: string): Promise<CrmCustomerMemoryResponse> {
    await this.ensureDerivedTasks();

    const customer = await this.getCustomerMemoryProfile(customerId);
    const [preferences, recentTasks, recentSales] = await Promise.all([
      this.getCustomerPreferences(customerId),
      this.getRecentCustomerTasks(customerId),
      this.getRecentCustomerSales(customerId),
    ]);

    const lastInteraction = recentTasks[0] ?? null;
    const nextOpenTask =
      recentTasks.find((task) => isOpenCrmTaskStatus(task.taskStatus)) ?? null;

    return {
      customer,
      preferences: this.groupPreferences(preferences),
      recentSales,
      recentTasks,
      lastInteraction,
      nextSuggestedAction: this.buildSuggestedAction(customer.customerStatus, nextOpenTask),
    };
  }

  async createTask(
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ): Promise<CrmQueueItem> {
    const payload = parseCrmTaskCreatePayload(body);

    await this.ensureCustomerExists(payload.customerId);

    if (payload.ownerUserId) {
      await this.ensureUserExists(payload.ownerUserId);
    }

    if (payload.salesOrderId) {
      await this.ensureSalesOrderBelongsToCustomer(
        payload.salesOrderId,
        payload.customerId,
      );
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');
      const taskId = randomUUID();

      try {
        await this.insertTask(client, {
          id: taskId,
          customerId: payload.customerId,
          salesOrderId: payload.salesOrderId,
          taskType: payload.taskType,
          taskStatus: payload.taskStatus,
          priority: payload.priority,
          reason: payload.reason,
          notes: payload.notes,
          dueAt: payload.dueAt,
          completedAt: payload.completedAt,
          ownerUserId: payload.ownerUserId ?? currentUser?.id ?? null,
        });

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      return this.getTaskById(taskId);
    });
  }

  async updateTask(
    taskId: string,
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ): Promise<CrmQueueItem> {
    const patch = parseCrmTaskUpdatePayload(body);
    const currentTask = await this.getTaskById(taskId);

    if (patch.ownerUserId) {
      await this.ensureUserExists(patch.ownerUserId);
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const nextStatus = patch.taskStatus ?? currentTask.taskStatus;
        const nextCompletedAt = isOpenCrmTaskStatus(nextStatus)
          ? null
          : patch.completedAt !== undefined
            ? patch.completedAt ?? currentTask.completedAt ?? new Date().toISOString()
            : this.resolveCompletedAt(
                currentTask.taskStatus,
                nextStatus,
                currentTask.completedAt,
              );

        const nextNotes = patch.notes !== undefined ? patch.notes : currentTask.notes;
        const nextReason = patch.reason ?? currentTask.reason;
        const nextPriority = patch.priority ?? currentTask.priority;
        const nextDueAt =
          patch.dueAt !== undefined ? patch.dueAt : currentTask.dueAt;
        const nextOwnerUserId =
          patch.ownerUserId !== undefined
            ? patch.ownerUserId
            : currentTask.ownerUserId;

        await client.query(
          `UPDATE soi.customer_interactions
           SET
             interaction_status = $1,
             priority = $2,
             reason = $3,
             notes = $4,
             scheduled_for = $5,
             completed_at = $6,
             owner_user_id = $7,
             updated_at = NOW()
           WHERE id = $8;`,
          [
            nextStatus,
            nextPriority,
            nextReason,
            nextNotes,
            nextDueAt,
            nextCompletedAt,
            nextOwnerUserId,
            taskId,
          ],
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      return this.getTaskById(taskId);
    });
  }

  private async ensureDerivedTasks() {
    await this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        await this.syncDeliveredSaleTasks(
          client,
          'post_sale_due',
          POST_SALE_DELAY_DAYS,
          'Pedido entregue elegível para contato de pós-venda.',
          'high',
        );
        await this.syncDeliveredSaleTasks(
          client,
          'review_request_due',
          REVIEW_REQUEST_DELAY_DAYS,
          'Pedido entregue elegível para solicitação de avaliação.',
          'medium',
        );
        await this.syncReactivationTasks(client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  private async syncDeliveredSaleTasks(
    client: PoolClient,
    taskType: Extract<CrmTaskType, 'post_sale_due' | 'review_request_due'>,
    delayDays: number,
    reason: string,
    priority: 'high' | 'medium' | 'low',
  ) {
    const result = await client.query<
      QueryResultRow & {
        customerId: string;
        salesOrderId: string;
        saleDate: string;
      }
    >(
      `SELECT
         so.customer_id AS "customerId",
         so.id AS "salesOrderId",
         so.sale_date AS "saleDate"
       FROM soi.sales_orders AS so
       WHERE so.order_status = 'delivered'
         AND so.customer_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM soi.customer_interactions AS ci
           WHERE ci.sales_order_id = so.id
             AND ci.interaction_type = $1
         );`,
      [taskType],
    );

    for (const row of result.rows) {
      const dueAt = new Date(row.saleDate);
      dueAt.setDate(dueAt.getDate() + delayDays);

      await this.insertTask(client, {
        id: randomUUID(),
        customerId: row.customerId,
        salesOrderId: row.salesOrderId,
        taskType,
        taskStatus: 'pending',
        priority,
        reason,
        notes: null,
        dueAt: dueAt.toISOString(),
        completedAt: null,
        ownerUserId: null,
      });
    }
  }

  private async syncReactivationTasks(client: PoolClient) {
    const result = await client.query<
      QueryResultRow & {
        customerId: string;
      }
    >(
      `SELECT
         c.id AS "customerId"
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
         AND ${this.customerStatusExpression('m', 's')} = 'inativo'
         AND NOT EXISTS (
           SELECT 1
           FROM soi.customer_interactions AS ci
           WHERE ci.customer_id = c.id
             AND ci.interaction_type = 'reactivation_due'
             AND ci.interaction_status IN ('pending', 'attempt_open')
         );`,
    );

    for (const row of result.rows) {
      await this.insertTask(client, {
        id: randomUUID(),
        customerId: row.customerId,
        salesOrderId: null,
        taskType: 'reactivation_due',
        taskStatus: 'pending',
        priority: 'medium',
        reason: 'Cliente inativo elegível para reativação comercial.',
        notes: null,
        dueAt: new Date().toISOString(),
        completedAt: null,
        ownerUserId: null,
      });
    }
  }

  private async insertTask(
    client: PoolClient,
    input: {
      id: string;
      customerId: string;
      salesOrderId: string | null;
      taskType: CrmTaskType;
      taskStatus: CrmTaskStatus;
      priority: 'high' | 'medium' | 'low';
      reason: string;
      notes: string | null;
      dueAt: string | null;
      completedAt: string | null;
      ownerUserId: string | null;
    },
  ) {
    await client.query(
      `INSERT INTO soi.customer_interactions (
         id,
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING;`,
      [
        input.id,
        input.customerId,
        input.taskType,
        input.salesOrderId,
        input.reason,
        input.taskStatus,
        input.priority,
        input.dueAt,
        input.completedAt,
        input.notes,
        input.ownerUserId,
      ],
    );
  }

  private async getSummary(): Promise<CrmOverviewSummary> {
    const result = await this.db.query<SummaryRow>(
      `WITH task_base AS (
         SELECT
           ci.customer_id,
           ci.interaction_type,
           ci.interaction_status,
           ci.scheduled_for
         FROM soi.customer_interactions AS ci
         WHERE ci.interaction_type IN (
           'followup_pending',
           'post_sale_due',
           'review_request_due',
           'reactivation_due',
           'manual_action_due'
         )
       ),
       customer_base AS (
         SELECT
           ${this.customerStatusExpression('m', 's')} AS "customerStatus"
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
       )
       SELECT
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "totalOpenTasks",
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_status IN ('pending', 'attempt_open')
             AND scheduled_for IS NOT NULL
             AND scheduled_for < NOW()
         ), 0)::int AS "overdueTasks",
         COALESCE((
           SELECT COUNT(DISTINCT customer_id)
           FROM task_base
           WHERE interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "customersRequiringActionCount",
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_type = 'followup_pending'
             AND interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "followupPendingCount",
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_type = 'post_sale_due'
             AND interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "postSaleDueCount",
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_type = 'review_request_due'
             AND interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "reviewRequestDueCount",
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_type = 'reactivation_due'
             AND interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "reactivationDueCount",
         COALESCE((
           SELECT COUNT(*)
           FROM task_base
           WHERE interaction_type = 'manual_action_due'
             AND interaction_status IN ('pending', 'attempt_open')
         ), 0)::int AS "manualActionDueCount",
         COALESCE((
           SELECT COUNT(*)
           FROM customer_base
           WHERE "customerStatus" = 'recorrente'
         ), 0)::int AS "recurringCustomersCount",
         COALESCE((
           SELECT COUNT(*)
           FROM customer_base
           WHERE "customerStatus" = 'inativo'
         ), 0)::int AS "inactiveCustomersCount";`,
    );

    return (
      result.rows[0] ?? {
        totalOpenTasks: 0,
        overdueTasks: 0,
        customersRequiringActionCount: 0,
        followupPendingCount: 0,
        postSaleDueCount: 0,
        reviewRequestDueCount: 0,
        reactivationDueCount: 0,
        manualActionDueCount: 0,
        recurringCustomersCount: 0,
        inactiveCustomersCount: 0,
      }
    );
  }

  private async getRecurringCustomers() {
    const result = await this.db.query<RecurringCustomerRow>(
      `SELECT
         c.id AS "customerId",
         c.full_name AS "customerName",
         COALESCE(m.orders_count, 0)::int AS "ordersCount",
         COALESCE(m.total_revenue, 0)::text AS "totalRevenue",
         m.avg_ticket::text AS "avgTicket",
         m.last_purchase_at AS "lastPurchaseAt"
       FROM soi.customers AS c
       LEFT JOIN LATERAL (
         SELECT
           cm.orders_count,
           cm.total_revenue,
           cm.avg_ticket,
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
         AND ${this.customerStatusExpression('m', 's')} = 'recorrente'
       ORDER BY COALESCE(m.total_revenue, 0) DESC, c.full_name ASC
       LIMIT 6;`,
    );

    return result.rows;
  }

  private async listCustomerOptions() {
    const result = await this.db.query<CustomerOptionRow>(
      `SELECT
         c.id,
         c.full_name AS "fullName",
         c.phone,
         c.email,
         ${this.customerStatusExpression('m', 's')} AS "customerStatus"
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
       ORDER BY c.full_name ASC;`,
    );

    return result.rows;
  }

  private async listSaleOptions() {
    const result = await this.db.query<SaleOptionRow>(
      `SELECT
         so.id,
         so.sale_number AS "saleNumber",
         so.customer_id AS "customerId",
         c.full_name AS "customerName",
         so.sale_date AS "saleDate",
         so.order_status AS "orderStatus"
       FROM soi.sales_orders AS so
       LEFT JOIN soi.customers AS c ON c.id = so.customer_id
       WHERE so.customer_id IS NOT NULL
       ORDER BY so.sale_date DESC, so.created_at DESC
       LIMIT 40;`,
    );

    return result.rows;
  }

  private async getCustomerMemoryProfile(customerId: string) {
    const result = await this.db.query<CustomerMemoryRow>(
      `SELECT
         c.id,
         c.full_name AS "fullName",
         c.phone,
         c.email,
         COALESCE(
           sales_channel.channel_name,
           acquisition_channel.channel_name
         ) AS "primaryChannelName",
         m.first_purchase_at AS "firstPurchaseAt",
         m.last_purchase_at AS "lastPurchaseAt",
         COALESCE(m.orders_count, 0)::int AS "ordersCount",
         COALESCE(m.total_revenue, 0)::text AS "totalRevenue",
         m.avg_ticket::text AS "avgTicket",
         ${this.customerStatusExpression('m', 's')} AS "customerStatus",
         c.notes
       FROM soi.customers AS c
       LEFT JOIN soi.channels AS acquisition_channel
         ON acquisition_channel.id = c.acquisition_channel_id
       LEFT JOIN LATERAL (
         SELECT
           ch.channel_name
         FROM soi.sales_orders AS so
         INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
         WHERE so.customer_id = c.id
         GROUP BY ch.channel_name
         ORDER BY COUNT(*) DESC, MAX(so.sale_date) DESC, ch.channel_name ASC
         LIMIT 1
       ) AS sales_channel ON true
       LEFT JOIN LATERAL (
         SELECT
           cm.first_purchase_at,
           cm.last_purchase_at,
           cm.orders_count,
           cm.total_revenue,
           cm.avg_ticket,
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

  private async getCustomerPreferences(customerId: string) {
    const result = await this.db.query<CustomerPreferenceRow>(
      `SELECT
         cp.id,
         cp.preference_type AS "preferenceType",
         cp.preference_value AS "preferenceValue",
         cp.source
       FROM soi.customer_preferences AS cp
       WHERE cp.customer_id = $1
       ORDER BY cp.created_at DESC, cp.preference_type ASC;`,
      [customerId],
    );

    return result.rows;
  }

  private groupPreferences(rows: CustomerPreferenceRow[]) {
    const bucket = {
      highlights: [] as Array<{
        id: string;
        label: string;
        value: string;
        source: string | null;
      }>,
      objections: [] as Array<{
        id: string;
        label: string;
        value: string;
        source: string | null;
      }>,
      occasions: [] as Array<{
        id: string;
        label: string;
        value: string;
        source: string | null;
      }>,
      contexts: [] as Array<{
        id: string;
        label: string;
        value: string;
        source: string | null;
      }>,
    };

    rows.forEach((row) => {
      const normalizedType = row.preferenceType.trim().toLowerCase();
      const entry = {
        id: row.id,
        label: row.preferenceType,
        value: row.preferenceValue,
        source: row.source,
      };

      if (normalizedType.includes('obj')) {
        bucket.objections.push(entry);
        return;
      }

      if (
        normalizedType.includes('ocas') ||
        normalizedType.includes('evento') ||
        normalizedType.includes('presente')
      ) {
        bucket.occasions.push(entry);
        return;
      }

      if (
        normalizedType.includes('context') ||
        normalizedType.includes('contexto')
      ) {
        bucket.contexts.push(entry);
        return;
      }

      bucket.highlights.push(entry);
    });

    return bucket;
  }

  private async getRecentCustomerTasks(customerId: string) {
    const result = await this.db.query<QueueRow>(
      `${this.baseQueueSelect()}
       WHERE ci.customer_id = $1
       ORDER BY
         COALESCE(ci.completed_at, ci.updated_at, ci.created_at) DESC,
         ci.created_at DESC
       LIMIT 12;`,
      [customerId],
    );

    return result.rows;
  }

  private async getRecentCustomerSales(customerId: string) {
    const result = await this.db.query<CustomerSaleRow>(
      `SELECT
         so.id,
         so.sale_number AS "saleNumber",
         so.sale_date AS "saleDate",
         ch.channel_name AS "channelName",
         so.order_status AS "orderStatus",
         COALESCE(so.gross_revenue, 0)::text AS "grossRevenue",
         COALESCE(so.net_revenue, 0)::text AS "netRevenue",
         COALESCE(so.gross_profit, 0)::text AS "grossProfit"
       FROM soi.sales_orders AS so
       INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
       WHERE so.customer_id = $1
       ORDER BY so.sale_date DESC, so.created_at DESC
       LIMIT 5;`,
      [customerId],
    );

    return result.rows;
  }

  private buildSuggestedAction(
    customerStatus: CustomerStatus,
    nextOpenTask: CrmQueueItem | null,
  ): CrmSuggestedAction | null {
    if (nextOpenTask) {
      return {
        label: this.taskTypeLabel(nextOpenTask.taskType),
        reason: nextOpenTask.reason,
        dueAt: nextOpenTask.dueAt,
        taskId: nextOpenTask.id,
        taskType: nextOpenTask.taskType,
        taskStatus: nextOpenTask.taskStatus,
      };
    }

    if (customerStatus === 'inativo') {
      return {
        label: 'Sugerir reativação',
        reason: 'Cliente sem ação pendente e já fora da janela de atividade.',
        dueAt: null,
        taskId: null,
        taskType: 'reactivation_due',
        taskStatus: null,
      };
    }

    if (customerStatus === 'lead') {
      return {
        label: 'Registrar primeiro follow-up',
        reason: 'Cadastro ativo sem compras e sem tarefa operacional em aberto.',
        dueAt: null,
        taskId: null,
        taskType: 'followup_pending',
        taskStatus: null,
      };
    }

    return null;
  }

  private async getQueueResult(filters: CrmQueueFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.customerId) {
      params.push(filters.customerId);
      where.push(`ci.customer_id = $${params.length}`);
    }

    if (filters.taskType) {
      params.push(filters.taskType);
      where.push(`ci.interaction_type = $${params.length}`);
    } else {
      where.push(
        `ci.interaction_type IN (${CRM_QUEUE_TASK_TYPES.map((taskType) => `'${taskType}'`).join(', ')})`,
      );
    }

    if (filters.taskStatus) {
      params.push(filters.taskStatus);
      where.push(`ci.interaction_status = $${params.length}`);
    } else {
      where.push(`ci.interaction_status IN ('pending', 'attempt_open')`);
    }

    if (filters.onlyOverdue) {
      where.push(`ci.scheduled_for IS NOT NULL AND ci.scheduled_for < NOW()`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.customer_interactions AS ci
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const result = await this.db.query<QueueRow>(
      `${this.baseQueueSelect()}
       ${whereClause}
       ORDER BY
         CASE
           WHEN ci.scheduled_for IS NOT NULL AND ci.scheduled_for < NOW() THEN 0
           ELSE 1
         END,
         CASE ci.priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           ELSE 2
         END,
         ci.scheduled_for ASC NULLS LAST,
         ci.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    return {
      items: result.rows,
      totalItems,
      currentPage,
      totalPages,
    };
  }

  private async getQueueItems({
    page,
    pageSize,
    onlyOpen,
  }: {
    page: number;
    pageSize: number;
    onlyOpen: boolean;
  }) {
    const result = await this.getQueueResult({
      page,
      pageSize,
      onlyOverdue: undefined,
      customerId: undefined,
      taskStatus: onlyOpen ? undefined : ('done' as CrmTaskStatus),
      taskType: undefined,
    });

    return result.items;
  }

  private baseQueueSelect() {
    return `SELECT
      ci.id,
      ci.customer_id AS "customerId",
      c.full_name AS "customerName",
      c.phone AS "customerPhone",
      c.email AS "customerEmail",
      ${this.customerStatusExpression('m', 's')} AS "customerStatus",
      ci.sales_order_id AS "salesOrderId",
      so.sale_number AS "saleNumber",
      so.sale_date AS "saleDate",
      ch.channel_name AS "channelName",
      ci.interaction_type AS "taskType",
      ci.interaction_status AS "taskStatus",
      ci.priority,
      ci.reason,
      ci.notes,
      ci.scheduled_for AS "dueAt",
      ci.owner_user_id AS "ownerUserId",
      u.full_name AS "ownerUserName",
      ci.created_at AS "createdAt",
      ci.updated_at AS "updatedAt",
      ci.completed_at AS "completedAt",
      CASE
        WHEN ci.interaction_status IN ('pending', 'attempt_open')
          AND ci.scheduled_for IS NOT NULL
          AND ci.scheduled_for < NOW()
        THEN true
        ELSE false
      END AS "isOverdue"
    FROM soi.customer_interactions AS ci
    INNER JOIN soi.customers AS c ON c.id = ci.customer_id
    LEFT JOIN soi.sales_orders AS so ON so.id = ci.sales_order_id
    LEFT JOIN soi.channels AS ch ON ch.id = so.channel_id
    LEFT JOIN soi.users AS u ON u.id = ci.owner_user_id
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
    ) AS s ON true`;
  }

  private taskTypeLabel(taskType: CrmTaskType) {
    switch (taskType) {
      case 'followup_pending':
        return 'Follow-up pendente';
      case 'post_sale_due':
        return 'Pós-venda pendente';
      case 'review_request_due':
        return 'Avaliação pendente';
      case 'reactivation_due':
        return 'Reativação pendente';
      case 'manual_action_due':
        return 'Ação manual';
      case 'post_sale':
        return 'Pós-venda';
      case 'review_request':
        return 'Pedido de avaliação';
      case 'reactivation':
        return 'Reativação';
      default:
        return 'Interação operacional';
    }
  }

  private resolveCompletedAt(
    currentStatus: CrmTaskStatus,
    nextStatus: CrmTaskStatus,
    currentCompletedAt: string | null,
  ) {
    if (isOpenCrmTaskStatus(nextStatus)) {
      return null;
    }

    if (isOpenCrmTaskStatus(currentStatus) && !currentCompletedAt) {
      return new Date().toISOString();
    }

    return currentCompletedAt ?? new Date().toISOString();
  }

  private async getTaskById(taskId: string) {
    const result = await this.db.query<QueueRow>(
      `${this.baseQueueSelect()}
       WHERE ci.id = $1
       LIMIT 1;`,
      [taskId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Tarefa CRM não encontrada');
    }

    return result.rows[0];
  }

  private async ensureCustomerExists(customerId: string) {
    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM soi.customers WHERE id = $1) AS exists;',
      [customerId],
    );

    if (!result.rows[0]?.exists) {
      throw new NotFoundException('Cliente não encontrado');
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
         FROM soi.sales_orders
         WHERE id = $1
           AND customer_id = $2
       ) AS exists;`,
      [salesOrderId, customerId],
    );

    if (!result.rows[0]?.exists) {
      throw new BadRequestException('Pedido não encontrado para o cliente informado');
    }
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
}
