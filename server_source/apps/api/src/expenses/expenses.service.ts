import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { FinancialService } from '../financial/financial.service';
import {
  parseExpenseListFilters,
  parseOptionalText,
  parseOptionalUuid,
  parseRequiredCostNature,
  parseRequiredDate,
  parseRequiredMoney,
  parseRequiredPaymentMethod,
  parseRequiredText,
} from './expenses.utils';
import {
  EXPENSE_COST_NATURES,
  EXPENSE_PAYMENT_METHODS,
  ExpenseChannelOption,
  ExpenseListFilters,
  ExpenseListItem,
} from './expenses.types';

type ExpenseRow = QueryResultRow & ExpenseListItem;
type ChannelRow = QueryResultRow & ExpenseChannelOption;

type ExpensePayload = {
  expenseDate: string;
  expenseType: string;
  category: string;
  description: string;
  amount: string;
  channelId: string | null;
  costNature: 'fixed' | 'variable';
  paymentMethod: (typeof EXPENSE_PAYMENT_METHODS)[number];
  notes: string | null;
};

@Injectable()
export class ExpensesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly financialService: FinancialService,
  ) {}

  async listExpenses(filters: ExpenseListFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(
          COALESCE(e.expense_type, '') ILIKE $${params.length}
          OR COALESCE(e.category, '') ILIKE $${params.length}
          OR COALESCE(e.description, '') ILIKE $${params.length}
          OR COALESCE(e.notes, '') ILIKE $${params.length}
        )`,
      );
    }

    if (filters.category) {
      params.push(filters.category);
      where.push(`e.category = $${params.length}`);
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      where.push(`e.expense_date::date >= $${params.length}::date`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      where.push(`e.expense_date::date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.expenses AS e
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const currentPage = Math.min(filters.page, totalPages);
    const offset = (currentPage - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const itemsResult = await this.db.query<ExpenseRow>(
      `SELECT
         e.id,
         e.expense_date AS "expenseDate",
         e.expense_type AS "expenseType",
         e.category,
         e.description,
         e.amount::text AS amount,
         e.channel_id AS "channelId",
         ch.channel_name AS "channelName",
         e.cost_nature AS "costNature",
         e.payment_method AS "paymentMethod",
         e.notes,
         e.created_at AS "createdAt",
         e.updated_at AS "updatedAt",
         e.created_by AS "createdBy",
         u.full_name AS "createdByName"
       FROM soi.expenses AS e
       LEFT JOIN soi.channels AS ch ON ch.id = e.channel_id
       LEFT JOIN soi.users AS u ON u.id = e.created_by
       ${whereClause}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    const [channels, categoryRows] = await Promise.all([
      this.listChannels(),
      this.db.query<{ category: string }>(
        `SELECT DISTINCT category
         FROM soi.expenses
         WHERE category IS NOT NULL AND btrim(category) <> ''
         ORDER BY category ASC;`,
      ),
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
        category: filters.category ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      meta: {
        categories: categoryRows.rows.map((row) => row.category),
        channels,
        availableCostNatures: [...EXPENSE_COST_NATURES],
        availablePaymentMethods: [...EXPENSE_PAYMENT_METHODS],
      },
    };
  }

  async createExpense(
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    const payload = this.parseCreatePayload(body);

    if (payload.channelId) {
      const result = await this.db.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1
           FROM soi.channels
           WHERE id = $1
         ) AS exists;`,
        [payload.channelId],
      );

      if (!result.rows[0]?.exists) {
        throw new NotFoundException('Canal da despesa não encontrado');
      }
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');

      try {
        const result = await client.query<{ id: string }>(
          `INSERT INTO soi.expenses (
             expense_date,
             expense_type,
             category,
             description,
             amount,
             channel_id,
             cost_nature,
             payment_method,
             notes,
             created_by,
             updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING id;`,
          [
            payload.expenseDate,
            payload.expenseType,
            payload.category,
            payload.description,
            payload.amount,
            payload.channelId,
            payload.costNature,
            payload.paymentMethod,
            payload.notes,
            currentUser?.id ?? null,
          ],
        );

        await this.financialService.syncPayableForExpense(
          client,
          result.rows[0].id,
          currentUser,
        );

        await client.query('COMMIT');

        const created = await this.db.query<ExpenseRow>(
          `SELECT
             e.id,
             e.expense_date AS "expenseDate",
             e.expense_type AS "expenseType",
             e.category,
             e.description,
             e.amount::text AS amount,
             e.channel_id AS "channelId",
             ch.channel_name AS "channelName",
             e.cost_nature AS "costNature",
             e.payment_method AS "paymentMethod",
             e.notes,
             e.created_at AS "createdAt",
             e.updated_at AS "updatedAt",
             e.created_by AS "createdBy",
             u.full_name AS "createdByName"
           FROM soi.expenses AS e
           LEFT JOIN soi.channels AS ch ON ch.id = e.channel_id
           LEFT JOIN soi.users AS u ON u.id = e.created_by
           WHERE e.id = $1
           LIMIT 1;`,
          [result.rows[0].id],
        );

        return created.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  private async listChannels() {
    const result = await this.db.query<ChannelRow>(
      `SELECT
         id,
         channel_key AS "channelKey",
         channel_name AS "channelName",
         is_active AS "isActive"
       FROM soi.channels
       WHERE is_active = true
       ORDER BY channel_name ASC;`,
    );

    return result.rows;
  }

  private parseCreatePayload(body: Record<string, unknown>): ExpensePayload {
    return {
      expenseDate: parseRequiredDate(body.expenseDate, 'expenseDate'),
      expenseType: parseRequiredText(body.expenseType, 'expenseType', 80),
      category: parseRequiredText(body.category, 'category', 120),
      description: parseRequiredText(body.description, 'description', 240),
      amount: parseRequiredMoney(body.amount, 'amount'),
      channelId: parseOptionalUuid(body.channelId, 'channelId') ?? null,
      costNature: parseRequiredCostNature(body.costNature, 'costNature'),
      paymentMethod: parseRequiredPaymentMethod(
        body.paymentMethod,
        'paymentMethod',
      ),
      notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
    };
  }

  parseFilters(query: Record<string, string | undefined>) {
    return parseExpenseListFilters(query);
  }
}
