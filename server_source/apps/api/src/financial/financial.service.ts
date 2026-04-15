import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient, QueryResultRow } from 'pg';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  FinancialCashflowBucket,
  FinancialCashflowFilters,
  FinancialCashflowResponse,
  FinancialCashflowSummary,
  FinancialChannelRuleRecord,
  FinancialOverviewResponse,
  FinancialPayableListFilters,
  FinancialPayableListItem,
  FinancialPayablesResponse,
  FinancialPnlChannelSummary,
  FinancialPnlFilters,
  FinancialPnlResponse,
  FinancialPnlSummary,
  FinancialReceivableListFilters,
  FinancialReceivableListItem,
  FinancialReceivablesResponse,
  FinancialSettlementBatchRecord,
  FinancialSettlementFilters,
  FinancialSettlementsResponse,
  FinancialSettlementRule,
  FinancialSettlementType,
} from './financial.types';
import {
  parseChannelRulePatch,
  parseFinancialCashflowFilters,
  parseFinancialPayableFilters,
  parseFinancialPnlFilters,
  parseFinancialReceivableFilters,
  parseFinancialSettlementFilters,
  parseGenerateIfoodSettlementBatch,
  parsePayablePatch,
  parseReceivablePatch,
  parseSettlementBatchPatch,
} from './financial.utils';

type QueryExecutor = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
};

type ReceivableRow = QueryResultRow & FinancialReceivableListItem;
type PayableRow = QueryResultRow & FinancialPayableListItem;
type ChannelRuleRow = QueryResultRow & FinancialChannelRuleRecord;
type SettlementBatchRow = QueryResultRow & FinancialSettlementBatchRecord;
type SupplierOptionRow = QueryResultRow & {
  id: string;
  supplierCode: string | null;
  name: string;
  isActive: boolean;
};
type ChannelOptionRow = QueryResultRow & {
  id: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
};
type SaleFinancialSource = {
  id: string;
  saleNumber: string;
  saleDate: string;
  customerId: string | null;
  customerName: string | null;
  channelId: string;
  channelKey: string;
  channelName: string;
  orderStatus: string;
  paymentStatus: string;
  grossRevenue: string;
  netRevenue: string;
  notes: string | null;
  paymentNotes: string | null;
};
type ExistingReceivableRow = QueryResultRow & {
  id: string;
  receivableNumber: string;
  expectedReceiptDate: string;
  actualReceiptDate: string | null;
  amountReceived: string;
  status: string;
  notes: string | null;
  isExpectedDateManual: boolean;
};
type PurchaseFinancialSource = {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string | null;
  supplierName: string | null;
  totalAmount: string;
  notes: string | null;
};
type ExistingPayableRow = QueryResultRow & {
  id: string;
  payableNumber: string;
  dueDate: string;
  actualPaymentDate: string | null;
  amountPaid: string;
  status: string;
  notes: string | null;
  isDueDateManual: boolean;
};
type ExpenseFinancialSource = {
  id: string;
  expenseDate: string | Date;
  expenseType: string;
  category: string | null;
  description: string | null;
  amount: string;
  costNature: 'fixed' | 'variable';
  paymentMethod: string;
  channelId: string | null;
  channelName: string | null;
  notes: string | null;
};
type CashflowBucketRow = QueryResultRow & FinancialCashflowBucket;
type PnlChannelRow = QueryResultRow & FinancialPnlChannelSummary;

const RECEIVABLE_STATUS_SQL = `
  CASE
    WHEN fr.status IN ('recebido', 'recebido_parcial', 'cancelado') THEN fr.status
    WHEN fr.expected_receipt_date < CURRENT_DATE THEN 'vencido'
    WHEN fr.expected_receipt_date = CURRENT_DATE THEN 'vencendo_hoje'
    ELSE 'previsto'
  END
`;

const PAYABLE_STATUS_SQL = `
  CASE
    WHEN fp.status IN ('pago', 'pago_parcial', 'cancelado') THEN fp.status
    WHEN fp.due_date < CURRENT_DATE THEN 'vencido'
    WHEN fp.due_date = CURRENT_DATE THEN 'vencendo_hoje'
    ELSE 'previsto'
  END
`;

@Injectable()
export class FinancialService {
  private baselineSyncPromise: Promise<void> | null = null;

  constructor(private readonly db: DatabaseService) {}

  parseReceivableFilters(query: Record<string, string | undefined>) {
    return parseFinancialReceivableFilters(query);
  }

  parsePayableFilters(query: Record<string, string | undefined>) {
    return parseFinancialPayableFilters(query);
  }

  parseCashflowFilters(query: Record<string, string | undefined>) {
    return parseFinancialCashflowFilters(query);
  }

  parsePnlFilters(query: Record<string, string | undefined>) {
    return parseFinancialPnlFilters(query);
  }

  parseSettlementFilters(query: Record<string, string | undefined>) {
    return parseFinancialSettlementFilters(query);
  }

  async getOverview(): Promise<FinancialOverviewResponse> {
    await this.syncExistingSourcesIfNeeded();

    const [summary7, summary30, pnl, receivables, payables, settlements, rules] =
      await Promise.all([
        this.getCashflowSummary({ windowDays: 7 }),
        this.getCashflowSummary({ windowDays: 30 }),
        this.getPnlSummary({}),
        this.fetchReceivableRows(
          {
            page: 1,
            pageSize: 6,
          },
          true,
        ),
        this.fetchPayableRows(
          {
            page: 1,
            pageSize: 6,
          },
          true,
        ),
        this.fetchSettlementBatchRows(
          {
            page: 1,
            pageSize: 6,
          },
          true,
        ),
        this.listChannelRules(),
      ]);

    const receivableToday = await this.db.query<{ total: string; count: string }>(
      `SELECT
         COALESCE(
           SUM(GREATEST(fr.net_expected_amount - fr.amount_received, 0)),
           0
         )::text AS total,
         COUNT(*)::text AS count
       FROM soi.financial_receivables AS fr
       WHERE (${RECEIVABLE_STATUS_SQL}) = 'vencendo_hoje';`,
    );

    const payableToday = await this.db.query<{ total: string; count: string }>(
      `SELECT
         COALESCE(
           SUM(GREATEST(fp.amount - fp.amount_paid, 0)),
           0
         )::text AS total,
         COUNT(*)::text AS count
       FROM soi.financial_payables AS fp
       WHERE (${PAYABLE_STATUS_SQL}) = 'vencendo_hoje';`,
    );

    const overdueExpenses = await this.db.query<{ total: string; count: string }>(
      `SELECT
         COALESCE(
           SUM(GREATEST(fp.amount - fp.amount_paid, 0)),
           0
         )::text AS total,
         COUNT(*)::text AS count
       FROM soi.financial_payables AS fp
       WHERE fp.source_type = 'expense'
         AND (${PAYABLE_STATUS_SQL}) = 'vencido';`,
    );

    const ifoodSettlement = await this.db.query<{ total: string; count: string }>(
      `SELECT
         COALESCE(
           SUM(CASE WHEN fsb.status <> 'cancelado' THEN fsb.expected_amount ELSE 0 END),
           0
         )::text AS total,
         COUNT(*) FILTER (WHERE fsb.status <> 'cancelado')::text AS count
       FROM soi.financial_settlement_batches AS fsb
       INNER JOIN soi.channels AS ch ON ch.id = fsb.channel_id
       WHERE ch.channel_key = 'ifood';`,
    );

    return {
      generatedAt: new Date().toISOString(),
      cards: {
        receivableToday: {
          label: 'Receber hoje',
          value: receivableToday.rows[0]?.total ?? '0.00',
          helper: `${receivableToday.rows[0]?.count ?? '0'} título(s)`,
        },
        payableToday: {
          label: 'Pagar hoje',
          value: payableToday.rows[0]?.total ?? '0.00',
          helper: `${payableToday.rows[0]?.count ?? '0'} título(s)`,
        },
        predictedBalance7Days: {
          label: 'Saldo previsto 7 dias',
          value: summary7.predictedBalance,
          helper: 'Entradas previstas menos saídas previstas',
        },
        predictedBalance30Days: {
          label: 'Saldo previsto 30 dias',
          value: summary30.predictedBalance,
          helper: 'Janela operacional do mês',
        },
        ifoodSettlement: {
          label: 'Repasse iFood previsto',
          value: ifoodSettlement.rows[0]?.total ?? '0.00',
          helper: `${ifoodSettlement.rows[0]?.count ?? '0'} lote(s)`,
        },
        overdueExpenses: {
          label: 'Despesas vencidas',
          value: overdueExpenses.rows[0]?.count ?? '0',
          helper: overdueExpenses.rows[0]?.total ?? '0.00',
        },
        managementMargin: {
          label: 'Margem gerencial do período',
          value: pnl.operatingMarginPct ?? '0',
          helper: 'Resultado operacional / receita líquida',
        },
      },
      receivablesDue: receivables.items,
      payablesDue: payables.items,
      alerts: this.buildAlerts(
        receivables.items,
        payables.items,
        settlements.items,
        overdueExpenses.rows[0]?.count ?? '0',
      ),
      cashflowSummary7Days: summary7,
      cashflowSummary30Days: summary30,
      pnlSummary: pnl,
      settlementBatches: settlements.items,
      channelRules: rules,
    };
  }

  async listReceivables(
    filters: FinancialReceivableListFilters,
  ): Promise<FinancialReceivablesResponse> {
    await this.syncExistingSourcesIfNeeded();
    return this.fetchReceivableRows(filters);
  }

  async listPayables(
    filters: FinancialPayableListFilters,
  ): Promise<FinancialPayablesResponse> {
    await this.syncExistingSourcesIfNeeded();
    return this.fetchPayableRows(filters);
  }

  async getCashflow(
    filters: FinancialCashflowFilters,
  ): Promise<FinancialCashflowResponse> {
    await this.syncExistingSourcesIfNeeded();

    const { dateFrom, dateTo } = this.normalizeDateRange(filters);
    const [buckets, channels] = await Promise.all([
      this.fetchCashflowBuckets({ ...filters, dateFrom, dateTo }),
      this.listChannelOptions(),
    ]);
    const summary = buckets.reduce<FinancialCashflowSummary>(
      (acc, bucket) => ({
        ...acc,
        entriesExpected: (
          Number(acc.entriesExpected) + Number(bucket.entriesExpected)
        ).toFixed(2),
        exitsExpected: (
          Number(acc.exitsExpected) + Number(bucket.exitsExpected)
        ).toFixed(2),
        predictedBalance: (
          Number(acc.predictedBalance) + Number(bucket.predictedBalance)
        ).toFixed(2),
        entriesRealized: (
          Number(acc.entriesRealized) + Number(bucket.entriesRealized)
        ).toFixed(2),
        exitsRealized: (
          Number(acc.exitsRealized) + Number(bucket.exitsRealized)
        ).toFixed(2),
        realizedBalance: (
          Number(acc.realizedBalance) + Number(bucket.realizedBalance)
        ).toFixed(2),
      }),
      {
        windowLabel: `${filters.windowDays} dias`,
        entriesExpected: '0.00',
        exitsExpected: '0.00',
        predictedBalance: '0.00',
        entriesRealized: '0.00',
        exitsRealized: '0.00',
        realizedBalance: '0.00',
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        windowDays: filters.windowDays,
        dateFrom,
        dateTo,
        channelId: filters.channelId ?? null,
        status: filters.status ?? null,
        costNature: filters.costNature ?? null,
      },
      meta: {
        channels,
      },
      summary,
      buckets,
    };
  }

  async getPnl(filters: FinancialPnlFilters): Promise<FinancialPnlResponse> {
    await this.syncExistingSourcesIfNeeded();
    const { dateFrom, dateTo } = this.normalizeDateRange(filters, 30);
    const [summary, channels, channelOptions] = await Promise.all([
      this.getPnlSummary({ ...filters, dateFrom, dateTo }),
      this.getPnlByChannel({ ...filters, dateFrom, dateTo }),
      this.listChannelOptions(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        dateFrom,
        dateTo,
        channelId: filters.channelId ?? null,
      },
      meta: {
        channels: channelOptions,
      },
      summary,
      channels,
    };
  }

  async listSettlements(
    filters: FinancialSettlementFilters,
  ): Promise<FinancialSettlementsResponse> {
    await this.syncExistingSourcesIfNeeded();
    return this.fetchSettlementBatchRows(filters);
  }

  async listChannelRules(): Promise<FinancialChannelRuleRecord[]> {
    await this.syncExistingSourcesIfNeeded();
    return this.fetchChannelRuleRows();
  }

  async updateChannelRule(
    ruleId: string,
    body: Record<string, unknown>,
  ): Promise<FinancialChannelRuleRecord> {
    const patch = parseChannelRulePatch(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'PATCH de regra financeira requer settlementType, expectedSettlementRule, expectedDays, feePct, isActive ou notes',
      );
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await this.ensureDefaultChannelRules(client);

        const existing = await client.query<ChannelRuleRow>(
          `SELECT
             fcr.id,
             fcr.channel_id AS "channelId",
             ch.channel_key AS "channelKey",
             ch.channel_name AS "channelName",
             fcr.settlement_type AS "settlementType",
             fcr.expected_settlement_rule AS "expectedSettlementRule",
             fcr.expected_days AS "expectedDays",
             fcr.fee_pct::text AS "feePct",
             fcr.is_active AS "isActive",
             fcr.notes,
             fcr.created_at AS "createdAt",
             fcr.updated_at AS "updatedAt"
           FROM soi.financial_channel_rules AS fcr
           INNER JOIN soi.channels AS ch ON ch.id = fcr.channel_id
           WHERE fcr.id = $1
           LIMIT 1
           FOR UPDATE;`,
          [ruleId],
        );

        const row = existing.rows[0];
        if (!row) {
          throw new NotFoundException('Regra financeira do canal não encontrada');
        }

        const nextSettlementType =
          patch.settlementType ?? row.settlementType;
        const nextSettlementRule =
          patch.expectedSettlementRule ?? row.expectedSettlementRule;
        const nextExpectedDays =
          patch.expectedDays !== undefined ? patch.expectedDays : row.expectedDays;

        this.validateRuleCombination(
          nextSettlementType,
          nextSettlementRule,
          nextExpectedDays,
        );

        const assignments: string[] = ['updated_at = NOW()'];
        const params: unknown[] = [];

        if (patch.settlementType !== undefined) {
          params.push(patch.settlementType);
          assignments.push(`settlement_type = $${params.length}`);
        }

        if (patch.expectedSettlementRule !== undefined) {
          params.push(patch.expectedSettlementRule);
          assignments.push(`expected_settlement_rule = $${params.length}`);
        }

        if (patch.expectedDays !== undefined) {
          params.push(patch.expectedDays);
          assignments.push(`expected_days = $${params.length}`);
        }

        if (patch.feePct !== undefined) {
          params.push(patch.feePct);
          assignments.push(`fee_pct = $${params.length}`);
        }

        if (patch.isActive !== undefined) {
          params.push(patch.isActive);
          assignments.push(`is_active = $${params.length}`);
        }

        if (patch.notes !== undefined) {
          params.push(patch.notes);
          assignments.push(`notes = $${params.length}`);
        }

        params.push(ruleId);
        await client.query(
          `UPDATE soi.financial_channel_rules
           SET ${assignments.join(', ')}
           WHERE id = $${params.length};`,
          params,
        );

        const affectedSales = await client.query<{ id: string }>(
          `SELECT so.id
           FROM soi.sales_orders AS so
           WHERE so.channel_id = $1
             AND so.order_status <> 'canceled';`,
          [row.channelId],
        );

        for (const sale of affectedSales.rows) {
          await this.syncReceivableForSale(client, sale.id);
        }

        await client.query('COMMIT');
        return this.getChannelRuleById(ruleId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async updateReceivable(
    receivableId: string,
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ): Promise<FinancialReceivableListItem> {
    const patch = parseReceivablePatch(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'PATCH de contas a receber requer expectedReceiptDate, actualReceiptDate, amountReceived, status ou notes',
      );
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const existingResult = await client.query<
          QueryResultRow & {
            id: string;
            salesOrderId: string | null;
            netExpectedAmount: string;
            amountReceived: string;
            expectedReceiptDate: string;
            actualReceiptDate: string | null;
            status: string;
            notes: string | null;
            isExpectedDateManual: boolean;
          }
        >(
          `SELECT
             fr.id,
             fr.sales_order_id AS "salesOrderId",
             fr.net_expected_amount::text AS "netExpectedAmount",
             fr.amount_received::text AS "amountReceived",
             fr.expected_receipt_date::text AS "expectedReceiptDate",
             fr.actual_receipt_date AS "actualReceiptDate",
             fr.status,
             fr.notes,
             fr.is_expected_date_manual AS "isExpectedDateManual"
           FROM soi.financial_receivables AS fr
           WHERE fr.id = $1
           LIMIT 1
           FOR UPDATE;`,
          [receivableId],
        );

        const existing = existingResult.rows[0];
        if (!existing) {
          throw new NotFoundException('Conta a receber não encontrada');
        }

        const expectedAmount = Number(existing.netExpectedAmount);
        const today = new Date().toISOString();
        const requestedStatus = patch.status;
        const nextExpectedDate =
          patch.expectedReceiptDate ?? existing.expectedReceiptDate;
        const nextActualDate =
          patch.actualReceiptDate !== undefined
            ? patch.actualReceiptDate
            : requestedStatus === 'recebido'
              ? existing.actualReceiptDate ?? today
              : requestedStatus === 'cancelado'
                ? null
                : existing.actualReceiptDate;
        const nextAmountReceived =
          patch.amountReceived !== undefined
            ? patch.amountReceived
            : requestedStatus === 'recebido'
              ? expectedAmount.toFixed(2)
              : requestedStatus === 'cancelado'
                ? '0.00'
                : existing.amountReceived;

        const derivedStatus =
          requestedStatus ??
          this.deriveStoredReceivableStatus(
            expectedAmount,
            Number(nextAmountReceived),
            nextActualDate,
            existing.status,
          );

        const assignments: string[] = [];
        const params: unknown[] = [];

        if (patch.expectedReceiptDate !== undefined) {
          params.push(nextExpectedDate);
          assignments.push(`expected_receipt_date = $${params.length}`);
          params.push(true);
          assignments.push(`is_expected_date_manual = $${params.length}`);
        }

        if (patch.actualReceiptDate !== undefined) {
          params.push(nextActualDate);
          assignments.push(`actual_receipt_date = $${params.length}`);
        }

        if (patch.amountReceived !== undefined) {
          params.push(nextAmountReceived);
          assignments.push(`amount_received = $${params.length}`);
        }

        if (
          patch.status !== undefined ||
          patch.amountReceived !== undefined ||
          (requestedStatus === 'recebido' && patch.amountReceived === undefined)
        ) {
          params.push(derivedStatus);
          assignments.push(`status = $${params.length}`);
        }

        if (patch.notes !== undefined) {
          params.push(patch.notes);
          assignments.push(`notes = $${params.length}`);
        }

        if (assignments.length === 0) {
          throw new BadRequestException('Nenhum campo financeiro foi alterado');
        }

        params.push(receivableId);
        await client.query(
          `UPDATE soi.financial_receivables
           SET ${assignments.join(', ')},
               updated_at = NOW()
           WHERE id = $${params.length};`,
          params,
        );

        if (existing.salesOrderId) {
          await this.syncSalePaymentStatusFromReceivable(
            client,
            existing.salesOrderId,
            derivedStatus,
            nextAmountReceived,
            expectedAmount,
          );
        }

        await client.query('COMMIT');
        return this.getReceivableById(receivableId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async updatePayable(
    payableId: string,
    body: Record<string, unknown>,
  ): Promise<FinancialPayableListItem> {
    const patch = parsePayablePatch(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'PATCH de contas a pagar requer dueDate, actualPaymentDate, amountPaid, status ou notes',
      );
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const existingResult = await client.query<
          QueryResultRow & {
            id: string;
            amount: string;
            amountPaid: string;
            dueDate: string;
            actualPaymentDate: string | null;
            status: string;
          }
        >(
          `SELECT
             fp.id,
             fp.amount::text AS amount,
             fp.amount_paid::text AS "amountPaid",
             fp.due_date::text AS "dueDate",
             fp.actual_payment_date AS "actualPaymentDate",
             fp.status
           FROM soi.financial_payables AS fp
           WHERE fp.id = $1
           LIMIT 1
           FOR UPDATE;`,
          [payableId],
        );

        const existing = existingResult.rows[0];
        if (!existing) {
          throw new NotFoundException('Conta a pagar não encontrada');
        }

        const totalAmount = Number(existing.amount);
        const today = new Date().toISOString();
        const requestedStatus = patch.status;
        const nextDueDate = patch.dueDate ?? existing.dueDate;
        const nextActualDate =
          patch.actualPaymentDate !== undefined
            ? patch.actualPaymentDate
            : requestedStatus === 'pago'
              ? existing.actualPaymentDate ?? today
              : requestedStatus === 'cancelado'
                ? null
                : existing.actualPaymentDate;
        const nextAmountPaid =
          patch.amountPaid !== undefined
            ? patch.amountPaid
            : requestedStatus === 'pago'
              ? totalAmount.toFixed(2)
              : requestedStatus === 'cancelado'
                ? '0.00'
                : existing.amountPaid;
        const derivedStatus =
          requestedStatus ??
          this.deriveStoredPayableStatus(
            totalAmount,
            Number(nextAmountPaid),
            nextActualDate,
            existing.status,
          );

        const assignments: string[] = [];
        const params: unknown[] = [];

        if (patch.dueDate !== undefined) {
          params.push(nextDueDate);
          assignments.push(`due_date = $${params.length}`);
          params.push(true);
          assignments.push(`is_due_date_manual = $${params.length}`);
        }

        if (patch.actualPaymentDate !== undefined) {
          params.push(nextActualDate);
          assignments.push(`actual_payment_date = $${params.length}`);
        }

        if (patch.amountPaid !== undefined) {
          params.push(nextAmountPaid);
          assignments.push(`amount_paid = $${params.length}`);
        }

        if (
          patch.status !== undefined ||
          patch.amountPaid !== undefined ||
          (requestedStatus === 'pago' && patch.amountPaid === undefined)
        ) {
          params.push(derivedStatus);
          assignments.push(`status = $${params.length}`);
        }

        if (patch.notes !== undefined) {
          params.push(patch.notes);
          assignments.push(`notes = $${params.length}`);
        }

        if (assignments.length === 0) {
          throw new BadRequestException('Nenhum campo financeiro foi alterado');
        }

        params.push(payableId);
        await client.query(
          `UPDATE soi.financial_payables
           SET ${assignments.join(', ')},
               updated_at = NOW()
           WHERE id = $${params.length};`,
          params,
        );

        await client.query('COMMIT');
        return this.getPayableById(payableId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async generateIfoodSettlementBatches(
    body: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ) {
    const payload = parseGenerateIfoodSettlementBatch(body);

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await this.ensureDefaultChannelRules(client);

        const ifoodChannel = await client.query<ChannelOptionRow>(
          `SELECT
             id,
             channel_key AS "channelKey",
             channel_name AS "channelName",
             is_active AS "isActive"
           FROM soi.channels
           WHERE channel_key = 'ifood'
           LIMIT 1
           FOR UPDATE;`,
        );

        const channel = ifoodChannel.rows[0];
        if (!channel) {
          throw new NotFoundException('Canal iFood não encontrado');
        }

        const groupedReceivables = await client.query<
          QueryResultRow & {
            expectedReceiptDate: string;
            competencyStart: string;
            competencyEnd: string;
            expectedAmount: string;
          }
        >(
          `SELECT
             fr.expected_receipt_date::text AS "expectedReceiptDate",
             MIN(fr.competency_date)::date::text AS "competencyStart",
             MAX(fr.competency_date)::date::text AS "competencyEnd",
             COALESCE(SUM(fr.net_expected_amount), 0)::text AS "expectedAmount"
           FROM soi.financial_receivables AS fr
           INNER JOIN soi.sales_orders AS so ON so.id = fr.sales_order_id
           INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
           WHERE ch.channel_key = 'ifood'
             AND fr.settlement_batch_id IS NULL
             AND fr.status NOT IN ('recebido', 'recebido_parcial', 'cancelado')
           GROUP BY fr.expected_receipt_date
           ORDER BY fr.expected_receipt_date ASC;`,
        );

        const createdBatchIds: string[] = [];

        for (const row of groupedReceivables.rows) {
          const batchReference = await this.generateNextSettlementBatchReference(
            client,
            'IFD',
          );
          const insertResult = await client.query<{ id: string }>(
            `INSERT INTO soi.financial_settlement_batches (
               batch_reference,
               channel_id,
               expected_settlement_rule,
               competency_start,
               competency_end,
               expected_receipt_date,
               expected_amount,
               received_amount,
               status,
               notes,
               created_by
             )
             VALUES ($1, $2, 'weekly_wednesday', $3, $4, $5, $6, 0, 'previsto', $7, $8)
             RETURNING id;`,
            [
              batchReference,
              channel.id,
              row.competencyStart,
              row.competencyEnd,
              row.expectedReceiptDate,
              row.expectedAmount,
              payload.notes,
              currentUser?.id ?? null,
            ],
          );

          const batchId = insertResult.rows[0].id;
          createdBatchIds.push(batchId);

          await client.query(
            `UPDATE soi.financial_receivables AS fr
             SET settlement_batch_id = $1,
                 updated_at = NOW()
             FROM soi.sales_orders AS so
             INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
             WHERE fr.sales_order_id = so.id
               AND ch.channel_key = 'ifood'
               AND fr.settlement_batch_id IS NULL
               AND fr.status NOT IN ('recebido', 'recebido_parcial', 'cancelado')
               AND fr.expected_receipt_date = $2::date;`,
            [batchId, row.expectedReceiptDate],
          );
        }

        await client.query('COMMIT');

        if (createdBatchIds.length === 0) {
          return [];
        }

        return this.getSettlementBatchesByIds(createdBatchIds);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async updateSettlementBatch(
    batchId: string,
    body: Record<string, unknown>,
  ): Promise<FinancialSettlementBatchRecord> {
    const patch = parseSettlementBatchPatch(body);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException(
        'PATCH de lote requer expectedReceiptDate, actualReceiptDate, receivedAmount, status ou notes',
      );
    }

    return this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        const existingResult = await client.query<
          QueryResultRow & {
            id: string;
            expectedAmount: string;
            receivedAmount: string;
            expectedReceiptDate: string;
            actualReceiptDate: string | null;
            status: string;
          }
        >(
          `SELECT
             fsb.id,
             fsb.expected_amount::text AS "expectedAmount",
             fsb.received_amount::text AS "receivedAmount",
             fsb.expected_receipt_date::text AS "expectedReceiptDate",
             fsb.actual_receipt_date AS "actualReceiptDate",
             fsb.status
           FROM soi.financial_settlement_batches AS fsb
           WHERE fsb.id = $1
           LIMIT 1
           FOR UPDATE;`,
          [batchId],
        );

        const existing = existingResult.rows[0];
        if (!existing) {
          throw new NotFoundException('Lote de repasse não encontrado');
        }

        const expectedAmount = Number(existing.expectedAmount);
        const today = new Date().toISOString();
        const requestedStatus = patch.status;
        const nextExpectedDate =
          patch.expectedReceiptDate ?? existing.expectedReceiptDate;
        const nextActualDate =
          patch.actualReceiptDate !== undefined
            ? patch.actualReceiptDate
            : requestedStatus === 'recebido'
              ? existing.actualReceiptDate ?? today
              : requestedStatus === 'cancelado'
                ? null
                : existing.actualReceiptDate;
        const nextReceivedAmount =
          patch.receivedAmount !== undefined
            ? patch.receivedAmount
            : requestedStatus === 'recebido'
              ? expectedAmount.toFixed(2)
              : requestedStatus === 'cancelado'
                ? '0.00'
                : existing.receivedAmount;
        const derivedStatus =
          requestedStatus ??
          this.deriveSettlementStatus(
            expectedAmount,
            Number(nextReceivedAmount),
            nextActualDate,
          );

        const assignments: string[] = [];
        const params: unknown[] = [];

        if (patch.expectedReceiptDate !== undefined) {
          params.push(nextExpectedDate);
          assignments.push(`expected_receipt_date = $${params.length}`);
        }

        if (patch.actualReceiptDate !== undefined) {
          params.push(nextActualDate);
          assignments.push(`actual_receipt_date = $${params.length}`);
        }

        if (patch.receivedAmount !== undefined) {
          params.push(nextReceivedAmount);
          assignments.push(`received_amount = $${params.length}`);
        }

        if (
          patch.status !== undefined ||
          patch.receivedAmount !== undefined ||
          (requestedStatus === 'recebido' && patch.receivedAmount === undefined)
        ) {
          params.push(derivedStatus);
          assignments.push(`status = $${params.length}`);
        }

        if (patch.notes !== undefined) {
          params.push(patch.notes);
          assignments.push(`notes = $${params.length}`);
        }

        params.push(batchId);
        await client.query(
          `UPDATE soi.financial_settlement_batches
           SET ${assignments.join(', ')},
               updated_at = NOW()
           WHERE id = $${params.length};`,
          params,
        );

        if (derivedStatus === 'cancelado') {
          await client.query(
            `UPDATE soi.financial_receivables
             SET settlement_batch_id = NULL,
                 updated_at = NOW()
             WHERE settlement_batch_id = $1
               AND status NOT IN ('recebido', 'recebido_parcial');`,
            [batchId],
          );
        } else if (derivedStatus === 'recebido' || derivedStatus === 'recebido_parcial') {
          const linkedReceivables = await client.query<
            QueryResultRow & { id: string; expectedAmount: string }
          >(
            `SELECT
               fr.id,
               fr.net_expected_amount::text AS "expectedAmount"
             FROM soi.financial_receivables AS fr
             WHERE fr.settlement_batch_id = $1
             ORDER BY fr.expected_receipt_date ASC, fr.created_at ASC;`,
            [batchId],
          );

          const expectedTotal = linkedReceivables.rows.reduce(
            (sum, row) => sum + Number(row.expectedAmount),
            0,
          );
          const ratio =
            expectedTotal > 0
              ? Math.min(Number(nextReceivedAmount) / expectedTotal, 1)
              : 0;

          for (const receivable of linkedReceivables.rows) {
            const receivedValue =
              derivedStatus === 'recebido'
                ? Number(receivable.expectedAmount)
                : Number(receivable.expectedAmount) * ratio;

            await client.query(
              `UPDATE soi.financial_receivables
               SET actual_receipt_date = $1,
                   amount_received = $2,
                   status = $3,
                   updated_at = NOW()
               WHERE id = $4;`,
              [
                nextActualDate ??
                  new Date().toISOString().slice(0, 10),
                receivedValue.toFixed(2),
                derivedStatus === 'recebido' ? 'recebido' : 'recebido_parcial',
                receivable.id,
              ],
            );

            const linkedSale = await client.query<{ salesOrderId: string | null }>(
              `SELECT sales_order_id AS "salesOrderId"
               FROM soi.financial_receivables
               WHERE id = $1
               LIMIT 1;`,
              [receivable.id],
            );

            const saleId = linkedSale.rows[0]?.salesOrderId;
            if (saleId) {
              await this.syncSalePaymentStatusFromReceivable(
                client,
                saleId,
                derivedStatus === 'recebido' ? 'recebido' : 'recebido_parcial',
                receivedValue.toFixed(2),
                Number(receivable.expectedAmount),
              );
            }
          }
        }

        await client.query('COMMIT');
        return this.getSettlementBatchById(batchId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  async syncReceivableForSale(
    client: PoolClient,
    saleId: string,
    currentUser?: AuthenticatedUser,
  ) {
    await this.ensureDefaultChannelRules(client);
    const sale = await this.getSaleFinancialSource(client, saleId);
    if (!sale) {
      throw new NotFoundException('Venda não encontrada para sincronização financeira');
    }

    const rule = await this.getChannelRuleByChannelId(client, sale.channelId);
    const existing = await client.query<ExistingReceivableRow>(
      `SELECT
         fr.id,
         fr.receivable_number AS "receivableNumber",
         fr.expected_receipt_date::text AS "expectedReceiptDate",
         fr.actual_receipt_date AS "actualReceiptDate",
         fr.amount_received::text AS "amountReceived",
         fr.status,
         fr.notes,
         fr.is_expected_date_manual AS "isExpectedDateManual"
       FROM soi.financial_receivables AS fr
       WHERE fr.sales_order_id = $1
       LIMIT 1
       FOR UPDATE;`,
      [saleId],
    );

    const current = existing.rows[0];
    const saleDate = this.toDateOnly(sale.saleDate);
    const expectedReceiptDate =
      current?.isExpectedDateManual && current.expectedReceiptDate
        ? current.expectedReceiptDate
        : this.computeExpectedSettlementDate(saleDate, rule);

    const amountReceived =
      sale.orderStatus === 'canceled' || sale.paymentStatus === 'refunded'
        ? '0.00'
        : sale.paymentStatus === 'paid'
          ? Number(sale.netRevenue).toFixed(2)
          : current?.amountReceived ?? '0.00';

    const actualReceiptDate =
      sale.paymentStatus === 'paid'
        ? current?.actualReceiptDate ?? saleDate
        : current?.actualReceiptDate ?? null;

    const storedStatus =
      sale.orderStatus === 'canceled' || sale.paymentStatus === 'refunded'
        ? 'cancelado'
        : sale.paymentStatus === 'paid'
          ? 'recebido'
          : Number(amountReceived) > 0
            ? 'recebido_parcial'
            : 'previsto';

    const notes = current?.notes ?? sale.paymentNotes ?? sale.notes ?? null;

    if (!current) {
      const receivableNumber = await this.generateNextReceivableNumber(client);
      await client.query(
        `INSERT INTO soi.financial_receivables (
           receivable_number,
           source_type,
           source_id,
           sales_order_id,
           settlement_batch_id,
           channel_id,
           customer_id,
           counterparty_name,
           gross_amount,
           net_expected_amount,
           competency_date,
           expected_receipt_date,
           actual_receipt_date,
           amount_received,
           status,
           is_expected_date_manual,
           notes,
           created_by
         )
         VALUES ($1, 'sale', $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, $14, $15);`,
        [
          receivableNumber,
          sale.id,
          sale.id,
          sale.channelId,
          sale.customerId,
          sale.customerName ?? sale.channelName,
          sale.grossRevenue,
          sale.netRevenue,
          saleDate,
          expectedReceiptDate,
          actualReceiptDate,
          amountReceived,
          storedStatus,
          notes,
          currentUser?.id ?? null,
        ],
      );
      return;
    }

    await client.query(
      `UPDATE soi.financial_receivables
       SET channel_id = $1,
           customer_id = $2,
           counterparty_name = $3,
           gross_amount = $4,
           net_expected_amount = $5,
           competency_date = $6,
           expected_receipt_date = $7,
           actual_receipt_date = $8,
           amount_received = $9,
           status = $10,
           notes = $11,
           updated_at = NOW()
       WHERE id = $12;`,
      [
        sale.channelId,
        sale.customerId,
        sale.customerName ?? sale.channelName,
        sale.grossRevenue,
        sale.netRevenue,
        saleDate,
        expectedReceiptDate,
        actualReceiptDate,
        amountReceived,
        storedStatus,
        notes,
        current.id,
      ],
    );
  }

  async syncPayableForPurchase(
    client: PoolClient,
    purchaseId: string,
    currentUser?: AuthenticatedUser,
  ) {
    const purchase = await this.getPurchaseFinancialSource(client, purchaseId);
    if (!purchase) {
      throw new NotFoundException('Compra não encontrada para sincronização financeira');
    }

    const existing = await client.query<ExistingPayableRow>(
      `SELECT
         fp.id,
         fp.payable_number AS "payableNumber",
         fp.due_date::text AS "dueDate",
         fp.actual_payment_date AS "actualPaymentDate",
         fp.amount_paid::text AS "amountPaid",
         fp.status,
         fp.notes,
         fp.is_due_date_manual AS "isDueDateManual"
       FROM soi.financial_payables AS fp
       WHERE fp.purchase_order_id = $1
       LIMIT 1
       FOR UPDATE;`,
      [purchaseId],
    );

    const current = existing.rows[0];
    const purchaseDate = this.toDateOnly(purchase.purchaseDate);
    const dueDate =
      current?.isDueDateManual && current.dueDate
        ? current.dueDate
        : purchaseDate;
    const storedStatus =
      Number(current?.amountPaid ?? 0) >= Number(purchase.totalAmount)
        ? 'pago'
        : Number(current?.amountPaid ?? 0) > 0
          ? 'pago_parcial'
          : 'previsto';

    if (!current) {
      const payableNumber = await this.generateNextPayableNumber(client);
      await client.query(
        `INSERT INTO soi.financial_payables (
           payable_number,
           source_type,
           source_id,
           purchase_order_id,
           expense_id,
           supplier_id,
           counterparty_name,
           category,
           cost_nature,
           amount,
           competency_date,
           due_date,
           actual_payment_date,
           amount_paid,
           payment_method,
           status,
           is_due_date_manual,
           notes,
           created_by
         )
         VALUES ($1, 'purchase', $2, $3, NULL, $4, $5, 'Compra de estoque', 'variable', $6, $7, $8, NULL, 0, NULL, 'previsto', false, $9, $10);`,
        [
          payableNumber,
          purchase.id,
          purchase.id,
          purchase.supplierId,
          purchase.supplierName ?? 'Fornecedor não informado',
          purchase.totalAmount,
          purchaseDate,
          dueDate,
          purchase.notes,
          currentUser?.id ?? null,
        ],
      );
      return;
    }

    await client.query(
      `UPDATE soi.financial_payables
       SET supplier_id = $1,
           counterparty_name = $2,
           amount = $3,
           competency_date = $4,
           due_date = $5,
           status = $6,
           notes = $7,
           updated_at = NOW()
       WHERE id = $8;`,
      [
        purchase.supplierId,
        purchase.supplierName ?? 'Fornecedor não informado',
        purchase.totalAmount,
        purchaseDate,
        dueDate,
        storedStatus,
        current.notes ?? purchase.notes,
        current.id,
      ],
    );
  }

  async syncPayableForExpense(
    client: PoolClient,
    expenseId: string,
    currentUser?: AuthenticatedUser,
  ) {
    const expense = await this.getExpenseFinancialSource(client, expenseId);
    if (!expense) {
      throw new NotFoundException('Despesa não encontrada para sincronização financeira');
    }

    const existing = await client.query<ExistingPayableRow>(
      `SELECT
         fp.id,
         fp.payable_number AS "payableNumber",
         fp.due_date::text AS "dueDate",
         fp.actual_payment_date AS "actualPaymentDate",
         fp.amount_paid::text AS "amountPaid",
         fp.status,
         fp.notes,
         fp.is_due_date_manual AS "isDueDateManual"
       FROM soi.financial_payables AS fp
       WHERE fp.expense_id = $1
       LIMIT 1
       FOR UPDATE;`,
      [expenseId],
    );

    const current = existing.rows[0];
    const expenseDate = this.toDateOnly(expense.expenseDate);
    const dueDate =
      current?.isDueDateManual && current.dueDate
        ? current.dueDate
        : expenseDate;
    const storedStatus =
      Number(current?.amountPaid ?? 0) >= Number(expense.amount)
        ? 'pago'
        : Number(current?.amountPaid ?? 0) > 0
          ? 'pago_parcial'
          : 'previsto';

    if (!current) {
      const payableNumber = await this.generateNextPayableNumber(client);
      await client.query(
        `INSERT INTO soi.financial_payables (
           payable_number,
           source_type,
           source_id,
           purchase_order_id,
           expense_id,
           supplier_id,
           counterparty_name,
           category,
           cost_nature,
           amount,
           competency_date,
           due_date,
           actual_payment_date,
           amount_paid,
           payment_method,
           status,
           is_due_date_manual,
           notes,
           created_by
         )
         VALUES ($1, 'expense', $2, NULL, $3, NULL, $4, $5, $6, $7, $8, $9, NULL, 0, $10, 'previsto', false, $11, $12);`,
        [
          payableNumber,
          expense.id,
          expense.id,
          expense.description ?? expense.expenseType,
          expense.category ?? expense.expenseType,
          expense.costNature,
          expense.amount,
          expenseDate,
          dueDate,
          expense.paymentMethod,
          expense.notes,
          currentUser?.id ?? null,
        ],
      );
      return;
    }

    await client.query(
      `UPDATE soi.financial_payables
       SET counterparty_name = $1,
           category = $2,
           cost_nature = $3,
           amount = $4,
           competency_date = $5,
           due_date = $6,
           payment_method = $7,
           status = $8,
           notes = $9,
           updated_at = NOW()
       WHERE id = $10;`,
      [
        expense.description ?? expense.expenseType,
        expense.category ?? expense.expenseType,
        expense.costNature,
        expense.amount,
        expenseDate,
        dueDate,
        expense.paymentMethod,
        storedStatus,
        current.notes ?? expense.notes,
        current.id,
      ],
    );
  }

  private async fetchReceivableRows(
    filters: FinancialReceivableListFilters,
    previewOnly = false,
  ): Promise<FinancialReceivablesResponse> {
    const where: string[] = [];
    const params: unknown[] = [];
    const computedStatusSql = RECEIVABLE_STATUS_SQL;

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(
          fr.receivable_number ILIKE $${params.length}
          OR COALESCE(so.sale_number, '') ILIKE $${params.length}
          OR COALESCE(c.full_name, '') ILIKE $${params.length}
          OR COALESCE(fr.counterparty_name, '') ILIKE $${params.length}
          OR COALESCE(ch.channel_name, '') ILIKE $${params.length}
        )`,
      );
    }

    if (filters.channelId) {
      params.push(filters.channelId);
      where.push(`fr.channel_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`(${computedStatusSql}) = $${params.length}`);
    } else if (previewOnly) {
      where.push(
        `(${computedStatusSql}) IN ('vencendo_hoje', 'vencido', 'recebido_parcial')`,
      );
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      where.push(`fr.expected_receipt_date >= $${params.length}::date`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      where.push(`fr.expected_receipt_date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.financial_receivables AS fr
       LEFT JOIN soi.sales_orders AS so ON so.id = fr.sales_order_id
       LEFT JOIN soi.channels AS ch ON ch.id = fr.channel_id
       LEFT JOIN soi.customers AS c ON c.id = fr.customer_id
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const page = Math.min(filters.page, totalPages);
    const offset = (page - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const rows = await this.db.query<ReceivableRow>(
      `SELECT
         fr.id,
         fr.receivable_number AS "receivableNumber",
         fr.source_type AS "sourceType",
         CASE fr.source_type
           WHEN 'sale' THEN 'Venda'
           WHEN 'manual_revenue' THEN 'Receita manual'
           ELSE 'Lote'
         END AS "sourceLabel",
         fr.source_id AS "sourceId",
         fr.sales_order_id AS "salesOrderId",
         so.sale_number AS "saleNumber",
         fr.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fr.customer_id AS "customerId",
         fr.counterparty_name AS "counterpartyName",
         fr.gross_amount::text AS "grossAmount",
         fr.net_expected_amount::text AS "netExpectedAmount",
         fr.competency_date AS "competencyDate",
         fr.expected_receipt_date::text AS "expectedReceiptDate",
         fr.actual_receipt_date AS "actualReceiptDate",
         fr.amount_received::text AS "amountReceived",
         (${computedStatusSql}) AS status,
         fr.notes,
         CASE
           WHEN fr.sales_order_id IS NOT NULL THEN '/sales/' || fr.sales_order_id::text
           ELSE NULL
         END AS "originHref",
         fr.settlement_batch_id AS "settlementBatchId",
         fsb.batch_reference AS "settlementBatchReference",
         fr.created_at AS "createdAt",
         fr.updated_at AS "updatedAt"
       FROM soi.financial_receivables AS fr
       LEFT JOIN soi.sales_orders AS so ON so.id = fr.sales_order_id
       LEFT JOIN soi.channels AS ch ON ch.id = fr.channel_id
       LEFT JOIN soi.customers AS c ON c.id = fr.customer_id
       LEFT JOIN soi.financial_settlement_batches AS fsb ON fsb.id = fr.settlement_batch_id
       ${whereClause}
       ORDER BY fr.expected_receipt_date ASC, fr.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    return {
      items: rows.rows,
      pagination: {
        page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
      },
      filters: {
        search: filters.search ?? null,
        channelId: filters.channelId ?? null,
        status: filters.status ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      meta: {
        channels: await this.listChannelOptions(),
        availableStatuses: [
          'previsto',
          'vencendo_hoje',
          'vencido',
          'recebido',
          'recebido_parcial',
          'cancelado',
        ],
      },
    };
  }

  private async fetchPayableRows(
    filters: FinancialPayableListFilters,
    previewOnly = false,
  ): Promise<FinancialPayablesResponse> {
    const where: string[] = [];
    const params: unknown[] = [];
    const computedStatusSql = PAYABLE_STATUS_SQL;

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(
          fp.payable_number ILIKE $${params.length}
          OR COALESCE(po.purchase_number, '') ILIKE $${params.length}
          OR COALESCE(s.name, '') ILIKE $${params.length}
          OR COALESCE(fp.counterparty_name, '') ILIKE $${params.length}
          OR COALESCE(fp.category, '') ILIKE $${params.length}
        )`,
      );
    }

    if (filters.supplierId) {
      params.push(filters.supplierId);
      where.push(`fp.supplier_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`(${computedStatusSql}) = $${params.length}`);
    } else if (previewOnly) {
      where.push(
        `(${computedStatusSql}) IN ('vencendo_hoje', 'vencido', 'pago_parcial')`,
      );
    }

    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      where.push(`fp.due_date >= $${params.length}::date`);
    }

    if (filters.dateTo) {
      params.push(filters.dateTo);
      where.push(`fp.due_date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.financial_payables AS fp
       LEFT JOIN soi.purchase_orders AS po ON po.id = fp.purchase_order_id
       LEFT JOIN soi.suppliers AS s ON s.id = fp.supplier_id
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const page = Math.min(filters.page, totalPages);
    const offset = (page - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const rows = await this.db.query<PayableRow>(
      `SELECT
         fp.id,
         fp.payable_number AS "payableNumber",
         fp.source_type AS "sourceType",
         CASE fp.source_type
           WHEN 'purchase' THEN 'Compra'
           WHEN 'expense' THEN 'Despesa'
           ELSE 'Lançamento manual'
         END AS "sourceLabel",
         fp.source_id AS "sourceId",
         fp.purchase_order_id AS "purchaseOrderId",
         po.purchase_number AS "purchaseNumber",
         fp.expense_id AS "expenseId",
         fp.supplier_id AS "supplierId",
         s.name AS "supplierName",
         fp.counterparty_name AS "counterpartyName",
         fp.category,
         fp.cost_nature AS "costNature",
         fp.amount::text AS amount,
         fp.competency_date AS "competencyDate",
         fp.due_date::text AS "dueDate",
         fp.actual_payment_date AS "actualPaymentDate",
         fp.amount_paid::text AS "amountPaid",
         fp.payment_method AS "paymentMethod",
         (${computedStatusSql}) AS status,
         fp.notes,
         CASE
           WHEN fp.purchase_order_id IS NOT NULL THEN '/purchases/' || fp.purchase_order_id::text
           WHEN fp.expense_id IS NOT NULL THEN '/expenses'
           ELSE NULL
         END AS "originHref",
         fp.created_at AS "createdAt",
         fp.updated_at AS "updatedAt"
       FROM soi.financial_payables AS fp
       LEFT JOIN soi.purchase_orders AS po ON po.id = fp.purchase_order_id
       LEFT JOIN soi.suppliers AS s ON s.id = fp.supplier_id
       ${whereClause}
       ORDER BY fp.due_date ASC, fp.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    return {
      items: rows.rows,
      pagination: {
        page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
      },
      filters: {
        search: filters.search ?? null,
        supplierId: filters.supplierId ?? null,
        status: filters.status ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
      },
      meta: {
        suppliers: await this.listSupplierOptions(),
        availableStatuses: [
          'previsto',
          'vencendo_hoje',
          'vencido',
          'pago',
          'pago_parcial',
          'cancelado',
        ],
      },
    };
  }

  private async fetchSettlementBatchRows(
    filters: FinancialSettlementFilters,
    previewOnly = false,
  ): Promise<FinancialSettlementsResponse> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      params.push(filters.status);
      where.push(`fsb.status = $${params.length}`);
    } else if (previewOnly) {
      where.push(`fsb.status IN ('previsto', 'recebido_parcial', 'divergente')`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM soi.financial_settlement_batches AS fsb
       ${whereClause};`,
      params,
    );

    const totalItems = Number(countResult.rows[0]?.total ?? '0');
    const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / filters.pageSize);
    const page = Math.min(filters.page, totalPages);
    const offset = (page - 1) * filters.pageSize;

    params.push(filters.pageSize);
    params.push(offset);

    const rows = await this.db.query<SettlementBatchRow>(
      `SELECT
         fsb.id,
         fsb.batch_reference AS "batchReference",
         fsb.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fsb.expected_settlement_rule AS "expectedSettlementRule",
         fsb.competency_start::text AS "competencyStart",
         fsb.competency_end::text AS "competencyEnd",
         fsb.expected_receipt_date::text AS "expectedReceiptDate",
         fsb.actual_receipt_date AS "actualReceiptDate",
         fsb.expected_amount::text AS "expectedAmount",
         fsb.received_amount::text AS "receivedAmount",
         fsb.status,
         fsb.notes,
         COALESCE(linked.count, 0)::int AS "linkedReceivablesCount",
         fsb.created_at AS "createdAt",
         fsb.updated_at AS "updatedAt"
       FROM soi.financial_settlement_batches AS fsb
       INNER JOIN soi.channels AS ch ON ch.id = fsb.channel_id
       LEFT JOIN (
         SELECT settlement_batch_id, COUNT(*)::int AS count
         FROM soi.financial_receivables
         WHERE settlement_batch_id IS NOT NULL
         GROUP BY settlement_batch_id
       ) AS linked ON linked.settlement_batch_id = fsb.id
       ${whereClause}
       ORDER BY fsb.expected_receipt_date ASC, fsb.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length};`,
      params,
    );

    return {
      items: rows.rows,
      pagination: {
        page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages,
      },
      filters: {
        status: filters.status ?? null,
      },
      meta: {
        availableStatuses: [
          'previsto',
          'recebido',
          'recebido_parcial',
          'divergente',
          'cancelado',
        ],
        channelRules: await this.fetchChannelRuleRows(),
      },
    };
  }

  private async fetchChannelRuleRows(): Promise<FinancialChannelRuleRecord[]> {
    const result = await this.db.query<ChannelRuleRow>(
      `SELECT
         fcr.id,
         fcr.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fcr.settlement_type AS "settlementType",
         fcr.expected_settlement_rule AS "expectedSettlementRule",
         fcr.expected_days AS "expectedDays",
         fcr.fee_pct::text AS "feePct",
         fcr.is_active AS "isActive",
         fcr.notes,
         fcr.created_at AS "createdAt",
         fcr.updated_at AS "updatedAt"
       FROM soi.financial_channel_rules AS fcr
       INNER JOIN soi.channels AS ch ON ch.id = fcr.channel_id
       ORDER BY ch.channel_name ASC;`,
    );

    return result.rows;
  }

  private async getChannelRuleById(ruleId: string) {
    const result = await this.db.query<ChannelRuleRow>(
      `SELECT
         fcr.id,
         fcr.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fcr.settlement_type AS "settlementType",
         fcr.expected_settlement_rule AS "expectedSettlementRule",
         fcr.expected_days AS "expectedDays",
         fcr.fee_pct::text AS "feePct",
         fcr.is_active AS "isActive",
         fcr.notes,
         fcr.created_at AS "createdAt",
         fcr.updated_at AS "updatedAt"
       FROM soi.financial_channel_rules AS fcr
       INNER JOIN soi.channels AS ch ON ch.id = fcr.channel_id
       WHERE fcr.id = $1
       LIMIT 1;`,
      [ruleId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Regra financeira não encontrada');
    }
    return row;
  }

  private async getReceivableById(receivableId: string) {
    const response = await this.fetchReceivableRows({
      page: 1,
      pageSize: 1,
      search: undefined,
      channelId: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });

    const item = response.items.find((row) => row.id === receivableId);
    if (!item) {
      const direct = await this.db.query<ReceivableRow>(
        `SELECT
           fr.id,
           fr.receivable_number AS "receivableNumber",
           fr.source_type AS "sourceType",
           CASE fr.source_type
             WHEN 'sale' THEN 'Venda'
             WHEN 'manual_revenue' THEN 'Receita manual'
             ELSE 'Lote'
           END AS "sourceLabel",
           fr.source_id AS "sourceId",
           fr.sales_order_id AS "salesOrderId",
           so.sale_number AS "saleNumber",
           fr.channel_id AS "channelId",
           ch.channel_key AS "channelKey",
           ch.channel_name AS "channelName",
           fr.customer_id AS "customerId",
           fr.counterparty_name AS "counterpartyName",
           fr.gross_amount::text AS "grossAmount",
           fr.net_expected_amount::text AS "netExpectedAmount",
           fr.competency_date AS "competencyDate",
           fr.expected_receipt_date::text AS "expectedReceiptDate",
           fr.actual_receipt_date AS "actualReceiptDate",
           fr.amount_received::text AS "amountReceived",
           (${RECEIVABLE_STATUS_SQL}) AS status,
           fr.notes,
           CASE
             WHEN fr.sales_order_id IS NOT NULL THEN '/sales/' || fr.sales_order_id::text
             ELSE NULL
           END AS "originHref",
           fr.settlement_batch_id AS "settlementBatchId",
           fsb.batch_reference AS "settlementBatchReference",
           fr.created_at AS "createdAt",
           fr.updated_at AS "updatedAt"
         FROM soi.financial_receivables AS fr
         LEFT JOIN soi.sales_orders AS so ON so.id = fr.sales_order_id
         LEFT JOIN soi.channels AS ch ON ch.id = fr.channel_id
         LEFT JOIN soi.financial_settlement_batches AS fsb ON fsb.id = fr.settlement_batch_id
         WHERE fr.id = $1
         LIMIT 1;`,
        [receivableId],
      );

      if (!direct.rows[0]) {
        throw new NotFoundException('Conta a receber não encontrada');
      }

      return direct.rows[0];
    }

    return item;
  }

  private async getPayableById(payableId: string) {
    const result = await this.db.query<PayableRow>(
      `SELECT
         fp.id,
         fp.payable_number AS "payableNumber",
         fp.source_type AS "sourceType",
         CASE fp.source_type
           WHEN 'purchase' THEN 'Compra'
           WHEN 'expense' THEN 'Despesa'
           ELSE 'Lançamento manual'
         END AS "sourceLabel",
         fp.source_id AS "sourceId",
         fp.purchase_order_id AS "purchaseOrderId",
         po.purchase_number AS "purchaseNumber",
         fp.expense_id AS "expenseId",
         fp.supplier_id AS "supplierId",
         s.name AS "supplierName",
         fp.counterparty_name AS "counterpartyName",
         fp.category,
         fp.cost_nature AS "costNature",
         fp.amount::text AS amount,
         fp.competency_date AS "competencyDate",
         fp.due_date::text AS "dueDate",
         fp.actual_payment_date AS "actualPaymentDate",
         fp.amount_paid::text AS "amountPaid",
         fp.payment_method AS "paymentMethod",
         (${PAYABLE_STATUS_SQL}) AS status,
         fp.notes,
         CASE
           WHEN fp.purchase_order_id IS NOT NULL THEN '/purchases/' || fp.purchase_order_id::text
           WHEN fp.expense_id IS NOT NULL THEN '/expenses'
           ELSE NULL
         END AS "originHref",
         fp.created_at AS "createdAt",
         fp.updated_at AS "updatedAt"
       FROM soi.financial_payables AS fp
       LEFT JOIN soi.purchase_orders AS po ON po.id = fp.purchase_order_id
       LEFT JOIN soi.suppliers AS s ON s.id = fp.supplier_id
       WHERE fp.id = $1
       LIMIT 1;`,
      [payableId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Conta a pagar não encontrada');
    }

    return result.rows[0];
  }

  private async getSettlementBatchById(batchId: string) {
    const result = await this.db.query<SettlementBatchRow>(
      `SELECT
         fsb.id,
         fsb.batch_reference AS "batchReference",
         fsb.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fsb.expected_settlement_rule AS "expectedSettlementRule",
         fsb.competency_start::text AS "competencyStart",
         fsb.competency_end::text AS "competencyEnd",
         fsb.expected_receipt_date::text AS "expectedReceiptDate",
         fsb.actual_receipt_date AS "actualReceiptDate",
         fsb.expected_amount::text AS "expectedAmount",
         fsb.received_amount::text AS "receivedAmount",
         fsb.status,
         fsb.notes,
         COALESCE(linked.count, 0)::int AS "linkedReceivablesCount",
         fsb.created_at AS "createdAt",
         fsb.updated_at AS "updatedAt"
       FROM soi.financial_settlement_batches AS fsb
       INNER JOIN soi.channels AS ch ON ch.id = fsb.channel_id
       LEFT JOIN (
         SELECT settlement_batch_id, COUNT(*)::int AS count
         FROM soi.financial_receivables
         WHERE settlement_batch_id IS NOT NULL
         GROUP BY settlement_batch_id
       ) AS linked ON linked.settlement_batch_id = fsb.id
       WHERE fsb.id = $1
       LIMIT 1;`,
      [batchId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Lote não encontrado');
    }

    return result.rows[0];
  }

  private async getSettlementBatchesByIds(batchIds: string[]) {
    const result = await this.db.query<SettlementBatchRow>(
      `SELECT
         fsb.id,
         fsb.batch_reference AS "batchReference",
         fsb.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fsb.expected_settlement_rule AS "expectedSettlementRule",
         fsb.competency_start::text AS "competencyStart",
         fsb.competency_end::text AS "competencyEnd",
         fsb.expected_receipt_date::text AS "expectedReceiptDate",
         fsb.actual_receipt_date AS "actualReceiptDate",
         fsb.expected_amount::text AS "expectedAmount",
         fsb.received_amount::text AS "receivedAmount",
         fsb.status,
         fsb.notes,
         COALESCE(linked.count, 0)::int AS "linkedReceivablesCount",
         fsb.created_at AS "createdAt",
         fsb.updated_at AS "updatedAt"
       FROM soi.financial_settlement_batches AS fsb
       INNER JOIN soi.channels AS ch ON ch.id = fsb.channel_id
       LEFT JOIN (
         SELECT settlement_batch_id, COUNT(*)::int AS count
         FROM soi.financial_receivables
         WHERE settlement_batch_id IS NOT NULL
         GROUP BY settlement_batch_id
       ) AS linked ON linked.settlement_batch_id = fsb.id
       WHERE fsb.id = ANY($1::uuid[])
       ORDER BY fsb.expected_receipt_date ASC, fsb.created_at ASC;`,
      [batchIds],
    );

    return result.rows;
  }

  private async getCashflowSummary(
    filters: Pick<FinancialCashflowFilters, 'windowDays'>,
  ): Promise<FinancialCashflowSummary> {
    const response = await this.getCashflow({
      windowDays: filters.windowDays,
    });
    return response.summary;
  }

  private async getPnlSummary(
    filters: FinancialPnlFilters & { dateFrom?: string; dateTo?: string },
  ): Promise<FinancialPnlSummary> {
    const { dateFrom, dateTo } = this.normalizeDateRange(filters, 30);
    const params: unknown[] = [dateFrom, dateTo];
    let channelClause = '';

    if (filters.channelId) {
      params.push(filters.channelId);
      channelClause = `AND so.channel_id = $${params.length}`;
    }

    const result = await this.db.query<FinancialPnlSummary>(
      `WITH sales_base AS (
         SELECT
           so.id,
           so.channel_id,
           COALESCE(so.gross_revenue, 0) AS gross_revenue,
           COALESCE(so.net_revenue, 0) AS net_revenue
         FROM soi.sales_orders AS so
         WHERE so.order_status = 'delivered'
           AND so.sale_date::date >= $1::date
           AND so.sale_date::date <= $2::date
           ${channelClause}
       ),
       cogs AS (
         SELECT
           soi.sales_order_id,
           COALESCE(SUM(soi.total_cost), 0) AS total_cost
         FROM soi.sales_order_items AS soi
         GROUP BY soi.sales_order_id
       ),
       extra_costs AS (
         SELECT
           sac.sales_order_id,
           COALESCE(SUM(sac.amount), 0) AS total_extra_cost
         FROM soi.sales_order_additional_costs AS sac
         GROUP BY sac.sales_order_id
       ),
       expenses AS (
         SELECT
           COALESCE(SUM(e.amount), 0) AS total_expenses
         FROM soi.expenses AS e
         WHERE e.expense_date::date >= $1::date
           AND e.expense_date::date <= $2::date
           ${
             filters.channelId
               ? `AND (e.channel_id = $${params.length} OR e.channel_id IS NULL)`
               : ''
           }
       )
       SELECT
         COALESCE(SUM(sb.gross_revenue), 0)::text AS "grossRevenue",
         COALESCE(SUM(sb.gross_revenue - sb.net_revenue), 0)::text AS "discountsAndFees",
         COALESCE(SUM(sb.net_revenue), 0)::text AS "netRevenue",
         COALESCE(SUM(c.total_cost), 0)::text AS cogs,
         COALESCE(SUM(ec.total_extra_cost), 0)::text AS "additionalSaleCosts",
         COALESCE(SUM(sb.net_revenue - COALESCE(c.total_cost, 0) - COALESCE(ec.total_extra_cost, 0)), 0)::text AS "grossProfit",
         (SELECT total_expenses::text FROM expenses)::text AS "operatingExpenses",
         (
           COALESCE(SUM(sb.net_revenue - COALESCE(c.total_cost, 0) - COALESCE(ec.total_extra_cost, 0)), 0)
           - COALESCE((SELECT total_expenses FROM expenses), 0)
         )::text AS "operatingResult",
         CASE
           WHEN COALESCE(SUM(sb.net_revenue), 0) > 0
             THEN ROUND((
               COALESCE(SUM(sb.net_revenue - COALESCE(c.total_cost, 0) - COALESCE(ec.total_extra_cost, 0)), 0)
               - COALESCE((SELECT total_expenses FROM expenses), 0)
             ) / SUM(sb.net_revenue), 4)::text
           ELSE NULL
         END AS "operatingMarginPct"
       FROM sales_base AS sb
       LEFT JOIN cogs AS c ON c.sales_order_id = sb.id
       LEFT JOIN extra_costs AS ec ON ec.sales_order_id = sb.id;`,
      params,
    );

    return (
      result.rows[0] ?? {
        grossRevenue: '0.00',
        discountsAndFees: '0.00',
        netRevenue: '0.00',
        cogs: '0.00',
        additionalSaleCosts: '0.00',
        grossProfit: '0.00',
        operatingExpenses: '0.00',
        operatingResult: '0.00',
        operatingMarginPct: null,
      }
    );
  }

  private async getPnlByChannel(
    filters: FinancialPnlFilters & { dateFrom?: string; dateTo?: string },
  ): Promise<FinancialPnlChannelSummary[]> {
    const { dateFrom, dateTo } = this.normalizeDateRange(filters, 30);
    const params: unknown[] = [dateFrom, dateTo];
    let channelClause = '';

    if (filters.channelId) {
      params.push(filters.channelId);
      channelClause = `AND ch.id = $${params.length}`;
    }

    const result = await this.db.query<PnlChannelRow>(
      `WITH sales_base AS (
         SELECT
           ch.id AS "channelId",
           ch.channel_key AS "channelKey",
           ch.channel_name AS "channelName",
           so.id AS sales_order_id,
           COALESCE(so.gross_revenue, 0) AS gross_revenue,
           COALESCE(so.net_revenue, 0) AS net_revenue
         FROM soi.channels AS ch
         LEFT JOIN soi.sales_orders AS so
           ON so.channel_id = ch.id
          AND so.order_status = 'delivered'
          AND so.sale_date::date >= $1::date
          AND so.sale_date::date <= $2::date
         WHERE ch.is_active = true
           ${channelClause}
       ),
       cogs AS (
         SELECT
           soi.sales_order_id,
           COALESCE(SUM(soi.total_cost), 0) AS total_cost
         FROM soi.sales_order_items AS soi
         GROUP BY soi.sales_order_id
       ),
       extra_costs AS (
         SELECT
           sac.sales_order_id,
           COALESCE(SUM(sac.amount), 0) AS total_extra_cost
         FROM soi.sales_order_additional_costs AS sac
         GROUP BY sac.sales_order_id
       ),
       expenses AS (
         SELECT
           e.channel_id,
           COALESCE(SUM(e.amount), 0) AS total_expenses
         FROM soi.expenses AS e
         WHERE e.expense_date::date >= $1::date
           AND e.expense_date::date <= $2::date
         GROUP BY e.channel_id
       ),
       shared_expenses AS (
         SELECT
           COALESCE(SUM(e.amount), 0) AS total_expenses
         FROM soi.expenses AS e
         WHERE e.expense_date::date >= $1::date
           AND e.expense_date::date <= $2::date
           AND e.channel_id IS NULL
       )
       SELECT
         sb."channelId",
         sb."channelKey",
         sb."channelName",
         COALESCE(SUM(sb.gross_revenue), 0)::text AS "grossRevenue",
         COALESCE(SUM(sb.gross_revenue - sb.net_revenue), 0)::text AS "discountsAndFees",
         COALESCE(SUM(sb.net_revenue), 0)::text AS "netRevenue",
         COALESCE(SUM(c.total_cost), 0)::text AS cogs,
         COALESCE(SUM(ec.total_extra_cost), 0)::text AS "additionalSaleCosts",
         COALESCE(SUM(sb.net_revenue - COALESCE(c.total_cost, 0) - COALESCE(ec.total_extra_cost, 0)), 0)::text AS "grossProfit",
         (
           COALESCE(ex.total_expenses, 0)
           + CASE WHEN COALESCE((SELECT COUNT(*) FROM soi.channels WHERE is_active = true), 0) > 0
               THEN COALESCE((SELECT total_expenses FROM shared_expenses), 0)
                    / (SELECT COUNT(*) FROM soi.channels WHERE is_active = true)
               ELSE 0
             END
         )::text AS "operatingExpenses",
         (
           COALESCE(SUM(sb.net_revenue - COALESCE(c.total_cost, 0) - COALESCE(ec.total_extra_cost, 0)), 0)
           - (
             COALESCE(ex.total_expenses, 0)
             + CASE WHEN COALESCE((SELECT COUNT(*) FROM soi.channels WHERE is_active = true), 0) > 0
                 THEN COALESCE((SELECT total_expenses FROM shared_expenses), 0)
                      / (SELECT COUNT(*) FROM soi.channels WHERE is_active = true)
                 ELSE 0
               END
           )
         )::text AS "operatingResult",
         CASE
           WHEN COALESCE(SUM(sb.net_revenue), 0) > 0
             THEN ROUND((
               COALESCE(SUM(sb.net_revenue - COALESCE(c.total_cost, 0) - COALESCE(ec.total_extra_cost, 0)), 0)
               - (
                 COALESCE(ex.total_expenses, 0)
                 + CASE WHEN COALESCE((SELECT COUNT(*) FROM soi.channels WHERE is_active = true), 0) > 0
                     THEN COALESCE((SELECT total_expenses FROM shared_expenses), 0)
                          / (SELECT COUNT(*) FROM soi.channels WHERE is_active = true)
                     ELSE 0
                   END
               )
             ) / SUM(sb.net_revenue), 4)::text
           ELSE NULL
         END AS "operatingMarginPct"
       FROM sales_base AS sb
       LEFT JOIN cogs AS c ON c.sales_order_id = sb.sales_order_id
       LEFT JOIN extra_costs AS ec ON ec.sales_order_id = sb.sales_order_id
       LEFT JOIN expenses AS ex ON ex.channel_id = sb."channelId"
       GROUP BY sb."channelId", sb."channelKey", sb."channelName", ex.total_expenses
       ORDER BY sb."channelName" ASC;`,
      params,
    );

    return result.rows;
  }

  private async fetchCashflowBuckets(
    filters: FinancialCashflowFilters & { dateFrom: string; dateTo: string },
  ): Promise<FinancialCashflowBucket[]> {
    const params: unknown[] = [filters.dateFrom, filters.dateTo];
    const receivableWhere: string[] = [];
    const payableWhere: string[] = [];

    if (filters.channelId) {
      params.push(filters.channelId);
      receivableWhere.push(`fr.channel_id = $${params.length}`);
      payableWhere.push(`e.channel_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      receivableWhere.push(`(${RECEIVABLE_STATUS_SQL}) = $${params.length}`);
      payableWhere.push(`(${PAYABLE_STATUS_SQL}) = $${params.length}`);
    }

    if (filters.costNature) {
      params.push(filters.costNature);
      payableWhere.push(`fp.cost_nature = $${params.length}`);
    }

    const receivableFilterSql = receivableWhere.length
      ? `AND ${receivableWhere.join(' AND ')}`
      : '';
    const payableFilterSql = payableWhere.length
      ? `AND ${payableWhere.join(' AND ')}`
      : '';

    const result = await this.db.query<CashflowBucketRow>(
      `WITH dates AS (
         SELECT generate_series($1::date, $2::date, interval '1 day')::date AS reference_date
       ),
       receivable_expected AS (
         SELECT
           fr.expected_receipt_date AS reference_date,
           COALESCE(SUM(GREATEST(fr.net_expected_amount - fr.amount_received, 0)), 0)::numeric AS amount
         FROM soi.financial_receivables AS fr
         LEFT JOIN soi.sales_orders AS so ON so.id = fr.sales_order_id
         WHERE fr.status NOT IN ('recebido', 'cancelado')
           ${receivableFilterSql}
         GROUP BY fr.expected_receipt_date
       ),
       receivable_realized AS (
         SELECT
           fr.actual_receipt_date::date AS reference_date,
           COALESCE(SUM(fr.amount_received), 0)::numeric AS amount
         FROM soi.financial_receivables AS fr
         WHERE fr.actual_receipt_date IS NOT NULL
           AND fr.status IN ('recebido', 'recebido_parcial')
           ${receivableFilterSql}
         GROUP BY fr.actual_receipt_date::date
       ),
       payable_expected AS (
         SELECT
           fp.due_date AS reference_date,
           COALESCE(SUM(GREATEST(fp.amount - fp.amount_paid, 0)), 0)::numeric AS amount
         FROM soi.financial_payables AS fp
         LEFT JOIN soi.expenses AS e ON e.id = fp.expense_id
         WHERE fp.status NOT IN ('pago', 'cancelado')
           ${payableFilterSql}
         GROUP BY fp.due_date
       ),
       payable_realized AS (
         SELECT
           fp.actual_payment_date::date AS reference_date,
           COALESCE(SUM(fp.amount_paid), 0)::numeric AS amount
         FROM soi.financial_payables AS fp
         LEFT JOIN soi.expenses AS e ON e.id = fp.expense_id
         WHERE fp.actual_payment_date IS NOT NULL
           AND fp.status IN ('pago', 'pago_parcial')
           ${payableFilterSql}
         GROUP BY fp.actual_payment_date::date
       )
       SELECT
         dates.reference_date::text AS "referenceDate",
         COALESCE(re.amount, 0)::text AS "entriesExpected",
         COALESCE(pe.amount, 0)::text AS "exitsExpected",
         (COALESCE(re.amount, 0) - COALESCE(pe.amount, 0))::text AS "predictedBalance",
         COALESCE(rr.amount, 0)::text AS "entriesRealized",
         COALESCE(pr.amount, 0)::text AS "exitsRealized",
         (COALESCE(rr.amount, 0) - COALESCE(pr.amount, 0))::text AS "realizedBalance"
       FROM dates
       LEFT JOIN receivable_expected AS re ON re.reference_date = dates.reference_date
       LEFT JOIN receivable_realized AS rr ON rr.reference_date = dates.reference_date
       LEFT JOIN payable_expected AS pe ON pe.reference_date = dates.reference_date
       LEFT JOIN payable_realized AS pr ON pr.reference_date = dates.reference_date
       ORDER BY dates.reference_date ASC;`,
      params,
    );

    return result.rows;
  }

  private async listChannelOptions() {
    const result = await this.db.query<ChannelOptionRow>(
      `SELECT
         id,
         channel_key AS "channelKey",
         channel_name AS "channelName",
         is_active AS "isActive"
       FROM soi.channels
       ORDER BY channel_name ASC;`,
    );

    return result.rows;
  }

  private async listSupplierOptions() {
    const result = await this.db.query<SupplierOptionRow>(
      `SELECT
         id,
         supplier_code AS "supplierCode",
         name,
         is_active AS "isActive"
       FROM soi.suppliers
       ORDER BY name ASC;`,
    );

    return result.rows;
  }

  private async syncExistingSourcesIfNeeded() {
    if (this.baselineSyncPromise) {
      return this.baselineSyncPromise;
    }

    this.baselineSyncPromise = this.runBaselineSync();
    try {
      await this.baselineSyncPromise;
    } finally {
      this.baselineSyncPromise = null;
    }
  }

  private async runBaselineSync() {
    await this.db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await this.ensureDefaultChannelRules(client);

        const sales = await client.query<{ id: string }>(
          `SELECT id FROM soi.sales_orders ORDER BY created_at ASC;`,
        );
        const purchases = await client.query<{ id: string }>(
          `SELECT id FROM soi.purchase_orders ORDER BY created_at ASC;`,
        );
        const expenses = await client.query<{ id: string }>(
          `SELECT id FROM soi.expenses ORDER BY created_at ASC;`,
        );

        for (const sale of sales.rows) {
          await this.syncReceivableForSale(client, sale.id);
        }

        for (const purchase of purchases.rows) {
          await this.syncPayableForPurchase(client, purchase.id);
        }

        for (const expense of expenses.rows) {
          await this.syncPayableForExpense(client, expense.id);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  private async ensureDefaultChannelRules(executor: QueryExecutor) {
    const channelsResult = await executor.query<ChannelOptionRow>(
      `SELECT
         id,
         channel_key AS "channelKey",
         channel_name AS "channelName",
         is_active AS "isActive"
       FROM soi.channels
       ORDER BY channel_name ASC;`,
    );
    const settingsResult = await executor.query<{
      feeWhatsapp: string;
      feeInstagram: string;
      feeIfood: string;
      feeCounter: string;
    }>(
      `SELECT
         COALESCE(fee_whatsapp, 0)::text AS "feeWhatsapp",
         COALESCE(fee_instagram, 0)::text AS "feeInstagram",
         COALESCE(fee_ifood, 0)::text AS "feeIfood",
         COALESCE(fee_counter, 0)::text AS "feeCounter"
       FROM soi.v_current_system_settings
       LIMIT 1;`,
    );

    const settings = settingsResult.rows[0] ?? {
      feeWhatsapp: '0.00',
      feeInstagram: '0.00',
      feeIfood: '0.00',
      feeCounter: '0.00',
    };

    for (const channel of channelsResult.rows) {
      const defaults = this.getChannelRuleDefaults(channel.channelKey, settings);
      await executor.query(
        `INSERT INTO soi.financial_channel_rules (
           channel_id,
           settlement_type,
           expected_settlement_rule,
           expected_days,
           fee_pct,
           is_active,
           notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (channel_id) DO NOTHING;`,
        [
          channel.id,
          defaults.settlementType,
          defaults.expectedSettlementRule,
          defaults.expectedDays,
          defaults.feePct,
          true,
          defaults.notes,
        ],
      );
    }
  }

  private getChannelRuleDefaults(
    channelKey: string,
    settings: {
      feeWhatsapp: string;
      feeInstagram: string;
      feeIfood: string;
      feeCounter: string;
    },
  ) {
    if (channelKey === 'ifood') {
      return {
        settlementType: 'marketplace_batch' as FinancialSettlementType,
        expectedSettlementRule: 'weekly_wednesday' as FinancialSettlementRule,
        expectedDays: null,
        feePct: settings.feeIfood,
        notes: 'Regra operacional padrão do iFood com repasse semanal às quartas-feiras.',
      };
    }

    if (channelKey === 'instagram') {
      return {
        settlementType: 'deferred' as FinancialSettlementType,
        expectedSettlementRule: 'same_day' as FinancialSettlementRule,
        expectedDays: 0,
        feePct: settings.feeInstagram,
        notes: 'Recebível gerencial padrão para vendas iniciadas pelo Instagram.',
      };
    }

    if (channelKey === 'whatsapp') {
      return {
        settlementType: 'immediate' as FinancialSettlementType,
        expectedSettlementRule: 'same_day' as FinancialSettlementRule,
        expectedDays: 0,
        feePct: settings.feeWhatsapp,
        notes: 'Recebível padrão do atendimento via WhatsApp.',
      };
    }

    return {
      settlementType: 'immediate' as FinancialSettlementType,
      expectedSettlementRule: 'same_day' as FinancialSettlementRule,
      expectedDays: 0,
      feePct: settings.feeCounter,
      notes: 'Recebível padrão do balcão.',
    };
  }

  private async getChannelRuleByChannelId(
    executor: QueryExecutor,
    channelId: string,
  ) {
    const result = await executor.query<ChannelRuleRow>(
      `SELECT
         fcr.id,
         fcr.channel_id AS "channelId",
         ch.channel_key AS "channelKey",
         ch.channel_name AS "channelName",
         fcr.settlement_type AS "settlementType",
         fcr.expected_settlement_rule AS "expectedSettlementRule",
         fcr.expected_days AS "expectedDays",
         fcr.fee_pct::text AS "feePct",
         fcr.is_active AS "isActive",
         fcr.notes,
         fcr.created_at AS "createdAt",
         fcr.updated_at AS "updatedAt"
       FROM soi.financial_channel_rules AS fcr
       INNER JOIN soi.channels AS ch ON ch.id = fcr.channel_id
       WHERE fcr.channel_id = $1
       LIMIT 1;`,
      [channelId],
    );

    const rule = result.rows[0];
    if (!rule) {
      throw new NotFoundException('Regra financeira do canal não encontrada');
    }

    return rule;
  }

  private async getSaleFinancialSource(
    executor: QueryExecutor,
    saleId: string,
  ): Promise<SaleFinancialSource | null> {
    const result = await executor.query<SaleFinancialSource>(
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
         COALESCE(so.gross_revenue, 0)::text AS "grossRevenue",
         COALESCE(so.net_revenue, 0)::text AS "netRevenue",
         so.notes,
         so.payment_notes AS "paymentNotes"
       FROM soi.sales_orders AS so
       INNER JOIN soi.channels AS ch ON ch.id = so.channel_id
       LEFT JOIN soi.customers AS c ON c.id = so.customer_id
       WHERE so.id = $1
       LIMIT 1;`,
      [saleId],
    );

    return result.rows[0] ?? null;
  }

  private async getPurchaseFinancialSource(
    executor: QueryExecutor,
    purchaseId: string,
  ): Promise<PurchaseFinancialSource | null> {
    const result = await executor.query<PurchaseFinancialSource>(
      `SELECT
         po.id,
         po.purchase_number AS "purchaseNumber",
         po.purchase_date AS "purchaseDate",
         po.supplier_id AS "supplierId",
         s.name AS "supplierName",
         COALESCE(po.total_amount, 0)::text AS "totalAmount",
         po.notes
       FROM soi.purchase_orders AS po
       LEFT JOIN soi.suppliers AS s ON s.id = po.supplier_id
       WHERE po.id = $1
       LIMIT 1;`,
      [purchaseId],
    );

    return result.rows[0] ?? null;
  }

  private async getExpenseFinancialSource(
    executor: QueryExecutor,
    expenseId: string,
  ): Promise<ExpenseFinancialSource | null> {
    const result = await executor.query<ExpenseFinancialSource>(
      `SELECT
         e.id,
         e.expense_date AS "expenseDate",
         e.expense_type AS "expenseType",
         e.category,
         e.description,
         e.amount::text AS amount,
         e.cost_nature AS "costNature",
         e.payment_method AS "paymentMethod",
         e.channel_id AS "channelId",
         ch.channel_name AS "channelName",
         e.notes
       FROM soi.expenses AS e
       LEFT JOIN soi.channels AS ch ON ch.id = e.channel_id
       WHERE e.id = $1
       LIMIT 1;`,
      [expenseId],
    );

    return result.rows[0] ?? null;
  }

  private computeExpectedSettlementDate(
    saleDate: string,
    rule: Pick<
      FinancialChannelRuleRecord,
      'expectedSettlementRule' | 'expectedDays'
    >,
  ) {
    const baseDate = new Date(saleDate);
    const normalized = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()),
    );

    switch (rule.expectedSettlementRule) {
      case 'next_day':
        normalized.setUTCDate(normalized.getUTCDate() + 1);
        return normalized.toISOString().slice(0, 10);
      case 'days_after_sale':
        normalized.setUTCDate(
          normalized.getUTCDate() + Number(rule.expectedDays ?? 0),
        );
        return normalized.toISOString().slice(0, 10);
      case 'weekly_wednesday': {
        normalized.setUTCDate(normalized.getUTCDate() + 1);
        while (normalized.getUTCDay() !== 3) {
          normalized.setUTCDate(normalized.getUTCDate() + 1);
        }
        return normalized.toISOString().slice(0, 10);
      }
      case 'manual':
        return normalized.toISOString().slice(0, 10);
      default:
        return normalized.toISOString().slice(0, 10);
    }
  }

  private toDateOnly(value: string | Date | null | undefined) {
    if (!value) {
      return new Date().toISOString().slice(0, 10);
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return String(value).slice(0, 10);
  }

  private deriveStoredReceivableStatus(
    expectedAmount: number,
    amountReceived: number,
    actualReceiptDate: string | null,
    currentStatus: string,
  ) {
    if (currentStatus === 'cancelado') {
      return 'cancelado';
    }

    if (amountReceived >= expectedAmount && actualReceiptDate) {
      return 'recebido';
    }

    if (amountReceived > 0 || actualReceiptDate) {
      return 'recebido_parcial';
    }

    return 'previsto';
  }

  private deriveStoredPayableStatus(
    totalAmount: number,
    amountPaid: number,
    actualPaymentDate: string | null,
    currentStatus: string,
  ) {
    if (currentStatus === 'cancelado') {
      return 'cancelado';
    }

    if (amountPaid >= totalAmount && actualPaymentDate) {
      return 'pago';
    }

    if (amountPaid > 0 || actualPaymentDate) {
      return 'pago_parcial';
    }

    return 'previsto';
  }

  private deriveSettlementStatus(
    expectedAmount: number,
    receivedAmount: number,
    actualReceiptDate: string | null,
  ) {
    if (receivedAmount >= expectedAmount && actualReceiptDate) {
      return 'recebido';
    }

    if (receivedAmount > 0 || actualReceiptDate) {
      return 'recebido_parcial';
    }

    return 'previsto';
  }

  private validateRuleCombination(
    settlementType: FinancialSettlementType,
    settlementRule: FinancialSettlementRule,
    expectedDays: number | null | undefined,
  ) {
    if (settlementRule === 'days_after_sale' && expectedDays == null) {
      throw new BadRequestException(
        'expectedDays é obrigatório quando a regra é days_after_sale',
      );
    }

    if (
      settlementType === 'marketplace_batch' &&
      !['weekly_wednesday', 'manual'].includes(settlementRule)
    ) {
      throw new BadRequestException(
        'Lotes de marketplace devem usar weekly_wednesday ou manual',
      );
    }
  }

  private async syncSalePaymentStatusFromReceivable(
    client: PoolClient,
    saleId: string,
    receivableStatus: string,
    amountReceived: string,
    expectedAmount: number,
  ) {
    const nextPaymentStatus =
      receivableStatus === 'recebido'
        ? 'paid'
        : receivableStatus === 'recebido_parcial' ||
            Number(amountReceived) < expectedAmount
          ? 'pending_confirmation'
          : undefined;

    if (!nextPaymentStatus) {
      return;
    }

    await client.query(
      `UPDATE soi.sales_orders
       SET payment_status = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [nextPaymentStatus, saleId],
    );
  }

  private normalizeDateRange(
    filters: { dateFrom?: string; dateTo?: string },
    fallbackWindowDays = 7,
  ) {
    const today = new Date();
    const start = filters.dateFrom
      ? new Date(`${filters.dateFrom}T12:00:00.000Z`)
      : new Date(
          Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
          ),
        );
    const end = filters.dateTo
      ? new Date(`${filters.dateTo}T12:00:00.000Z`)
      : new Date(start.getTime() + (fallbackWindowDays - 1) * 86400000);

    return {
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: end.toISOString().slice(0, 10),
    };
  }

  private async generateNextReceivableNumber(executor: QueryExecutor) {
    const result = await executor.query<{ nextValue: string }>(
      `SELECT
         LPAD(
           (
             COALESCE(
               MAX(
                 NULLIF(regexp_replace(receivable_number, '\\D', '', 'g'), '')::int
               ),
               0
             ) + 1
           )::text,
           6,
           '0'
         ) AS "nextValue"
       FROM soi.financial_receivables;`,
    );

    return `REC-${result.rows[0]?.nextValue ?? '000001'}`;
  }

  private async generateNextPayableNumber(executor: QueryExecutor) {
    const result = await executor.query<{ nextValue: string }>(
      `SELECT
         LPAD(
           (
             COALESCE(
               MAX(
                 NULLIF(regexp_replace(payable_number, '\\D', '', 'g'), '')::int
               ),
               0
             ) + 1
           )::text,
           6,
           '0'
         ) AS "nextValue"
       FROM soi.financial_payables;`,
    );

    return `PAG-${result.rows[0]?.nextValue ?? '000001'}`;
  }

  private async generateNextSettlementBatchReference(
    executor: QueryExecutor,
    prefix: string,
  ) {
    const result = await executor.query<{ nextValue: string }>(
      `SELECT
         LPAD(
           (
             COALESCE(
               MAX(
                 NULLIF(regexp_replace(batch_reference, '\\D', '', 'g'), '')::int
               ),
               0
             ) + 1
           )::text,
           6,
           '0'
         ) AS "nextValue"
       FROM soi.financial_settlement_batches;`,
    );

    return `${prefix}-${result.rows[0]?.nextValue ?? '000001'}`;
  }

  private buildAlerts(
    receivables: FinancialReceivableListItem[],
    payables: FinancialPayableListItem[],
    settlements: FinancialSettlementBatchRecord[],
    overdueExpensesCount: string,
  ) {
    const alerts = [];

    if (receivables.some((item) => item.status === 'vencido')) {
      alerts.push({
        id: 'receivable-overdue',
        title: 'Há contas a receber vencidas',
        description: 'Revise títulos em atraso e marque o recebimento quando houver baixa real.',
        tone: 'high' as const,
      });
    }

    if (payables.some((item) => item.status === 'vencido')) {
      alerts.push({
        id: 'payable-overdue',
        title: 'Há contas a pagar vencidas',
        description: 'Acompanhe fornecedores e despesas em atraso para não distorcer o caixa previsto.',
        tone: 'warning' as const,
      });
    }

    if (settlements.some((item) => item.status === 'divergente')) {
      alerts.push({
        id: 'ifood-divergent',
        title: 'Existe lote iFood divergente',
        description: 'Conferir competência, valor esperado e valor recebido do repasse.',
        tone: 'warning' as const,
      });
    }

    if (Number(overdueExpensesCount) > 0) {
      alerts.push({
        id: 'expense-overdue',
        title: 'Despesas vencidas precisam de baixa',
        description: 'As despesas pendentes ainda entram no fluxo previsto até serem marcadas como pagas.',
        tone: 'high' as const,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'financial-clean',
        title: 'Leitura financeira sem alertas críticos',
        description: 'O financeiro gerencial está coerente com os lançamentos atuais.',
        tone: 'success' as const,
      });
    }

    return alerts;
  }
}
