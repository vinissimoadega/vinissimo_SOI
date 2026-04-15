import { BadRequestException } from '@nestjs/common';
import {
  parseOptionalDateFilter,
  parseOptionalMoney,
  parseOptionalText,
  parseOptionalUuid,
  parsePositiveInteger,
  parseRequiredMoney,
  parseRequiredText,
} from '../sales/sales.utils';
import {
  FINANCIAL_PAYABLE_STATUSES,
  FINANCIAL_RECEIVABLE_STATUSES,
  FINANCIAL_SETTLEMENT_BATCH_STATUSES,
  FINANCIAL_SETTLEMENT_RULES,
  FINANCIAL_SETTLEMENT_TYPES,
  FinancialCashflowFilters,
  FinancialPayableListFilters,
  FinancialPayableStatus,
  FinancialPnlFilters,
  FinancialReceivableListFilters,
  FinancialReceivableStatus,
  FinancialSettlementBatchStatus,
  FinancialSettlementFilters,
  FinancialSettlementRule,
  FinancialSettlementType,
} from './financial.types';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseFinancialReceivableFilters(
  query: Record<string, string | undefined>,
): FinancialReceivableListFilters {
  return {
    search: parseOptionalText(query.search, 'search', 120) ?? undefined,
    channelId: parseOptionalUuid(query.channel_id, 'channel_id') ?? undefined,
    status:
      parseOptionalReceivableStatus(query.status, 'status') ?? undefined,
    dateFrom: parseOptionalDateFilter(query.date_from, 'date_from') ?? undefined,
    dateTo: parseOptionalDateFilter(query.date_to, 'date_to') ?? undefined,
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.page_size, 'page_size', 12, 50),
  };
}

export function parseFinancialPayableFilters(
  query: Record<string, string | undefined>,
): FinancialPayableListFilters {
  return {
    search: parseOptionalText(query.search, 'search', 120) ?? undefined,
    supplierId: parseOptionalUuid(query.supplier_id, 'supplier_id') ?? undefined,
    status: parseOptionalPayableStatus(query.status, 'status') ?? undefined,
    dateFrom: parseOptionalDateFilter(query.date_from, 'date_from') ?? undefined,
    dateTo: parseOptionalDateFilter(query.date_to, 'date_to') ?? undefined,
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.page_size, 'page_size', 12, 50),
  };
}

export function parseFinancialCashflowFilters(
  query: Record<string, string | undefined>,
): FinancialCashflowFilters {
  return {
    windowDays: parsePositiveInteger(query.window_days, 'window_days', 7, 365),
    dateFrom: parseOptionalDateFilter(query.date_from, 'date_from') ?? undefined,
    dateTo: parseOptionalDateFilter(query.date_to, 'date_to') ?? undefined,
    channelId: parseOptionalUuid(query.channel_id, 'channel_id') ?? undefined,
    status:
      parseOptionalReceivableStatus(query.status, 'status') ??
      parseOptionalPayableStatus(query.status, 'status') ??
      undefined,
    costNature:
      parseOptionalText(query.cost_nature, 'cost_nature', 30) === 'fixed'
        ? 'fixed'
        : parseOptionalText(query.cost_nature, 'cost_nature', 30) === 'variable'
          ? 'variable'
          : undefined,
  };
}

export function parseFinancialPnlFilters(
  query: Record<string, string | undefined>,
): FinancialPnlFilters {
  return {
    dateFrom: parseOptionalDateFilter(query.date_from, 'date_from') ?? undefined,
    dateTo: parseOptionalDateFilter(query.date_to, 'date_to') ?? undefined,
    channelId: parseOptionalUuid(query.channel_id, 'channel_id') ?? undefined,
  };
}

export function parseFinancialSettlementFilters(
  query: Record<string, string | undefined>,
): FinancialSettlementFilters {
  return {
    status:
      parseOptionalSettlementBatchStatus(query.status, 'status') ?? undefined,
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.page_size, 'page_size', 12, 50),
  };
}

export function parseReceivablePatch(body: Record<string, unknown>) {
  return {
    expectedReceiptDate:
      parseOptionalDateFilter(body.expectedReceiptDate, 'expectedReceiptDate') ??
      undefined,
    actualReceiptDate:
      parseOptionalDateFilter(body.actualReceiptDate, 'actualReceiptDate') ??
      undefined,
    amountReceived:
      parseOptionalMoney(body.amountReceived, 'amountReceived') ?? undefined,
    status: parseOptionalReceivableStatus(body.status, 'status') ?? undefined,
    notes: parseOptionalText(body.notes, 'notes', 1200) ?? undefined,
  };
}

export function parsePayablePatch(body: Record<string, unknown>) {
  return {
    dueDate: parseOptionalDateFilter(body.dueDate, 'dueDate') ?? undefined,
    actualPaymentDate:
      parseOptionalDateFilter(body.actualPaymentDate, 'actualPaymentDate') ??
      undefined,
    amountPaid: parseOptionalMoney(body.amountPaid, 'amountPaid') ?? undefined,
    status: parseOptionalPayableStatus(body.status, 'status') ?? undefined,
    notes: parseOptionalText(body.notes, 'notes', 1200) ?? undefined,
  };
}

export function parseChannelRulePatch(body: Record<string, unknown>) {
  const expectedDaysRaw = parseOptionalText(
    body.expectedDays,
    'expectedDays',
    20,
  );

  let expectedDays: number | null | undefined = undefined;
  if (expectedDaysRaw !== undefined) {
    if (expectedDaysRaw === null) {
      expectedDays = null;
    } else {
      const parsed = Number(expectedDaysRaw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new BadRequestException(
          'expectedDays deve ser inteiro não negativo',
        );
      }
      expectedDays = parsed;
    }
  }

  const isActiveRaw = body.isActive;
  let isActive: boolean | undefined;
  if (isActiveRaw !== undefined) {
    if (typeof isActiveRaw === 'boolean') {
      isActive = isActiveRaw;
    } else if (trimString(isActiveRaw).toLowerCase() === 'true') {
      isActive = true;
    } else if (trimString(isActiveRaw).toLowerCase() === 'false') {
      isActive = false;
    } else {
      throw new BadRequestException('isActive deve ser booleano');
    }
  }

  return {
    settlementType:
      parseOptionalSettlementType(body.settlementType, 'settlementType') ??
      undefined,
    expectedSettlementRule:
      parseOptionalSettlementRule(
        body.expectedSettlementRule,
        'expectedSettlementRule',
      ) ?? undefined,
    expectedDays,
    feePct: parseOptionalMoney(body.feePct, 'feePct') ?? undefined,
    isActive,
    notes: parseOptionalText(body.notes, 'notes', 1200) ?? undefined,
  };
}

export function parseSettlementBatchPatch(body: Record<string, unknown>) {
  return {
    expectedReceiptDate:
      parseOptionalDateFilter(body.expectedReceiptDate, 'expectedReceiptDate') ??
      undefined,
    actualReceiptDate:
      parseOptionalDateFilter(body.actualReceiptDate, 'actualReceiptDate') ??
      undefined,
    receivedAmount:
      parseOptionalMoney(body.receivedAmount, 'receivedAmount') ?? undefined,
    status:
      parseOptionalSettlementBatchStatus(body.status, 'status') ?? undefined,
    notes: parseOptionalText(body.notes, 'notes', 1200) ?? undefined,
  };
}

export function parseGenerateIfoodSettlementBatch(body: Record<string, unknown>) {
  return {
    notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
  };
}

export function parseManualReceivable(body: Record<string, unknown>) {
  return {
    counterpartyName: parseRequiredText(
      body.counterpartyName,
      'counterpartyName',
      180,
    ),
    grossAmount: parseRequiredMoney(body.grossAmount, 'grossAmount'),
    netExpectedAmount: parseRequiredMoney(
      body.netExpectedAmount,
      'netExpectedAmount',
    ),
    competencyDate: parseOptionalDateFilter(
      body.competencyDate,
      'competencyDate',
    ),
    expectedReceiptDate: parseOptionalDateFilter(
      body.expectedReceiptDate,
      'expectedReceiptDate',
    ),
    notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
  };
}

function parseOptionalReceivableStatus(
  value: unknown,
  field: string,
): FinancialReceivableStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    !FINANCIAL_RECEIVABLE_STATUSES.includes(
      normalized as FinancialReceivableStatus,
    )
  ) {
    throw new BadRequestException(
      `${field} inválido. Use: ${FINANCIAL_RECEIVABLE_STATUSES.join(', ')}`,
    );
  }

  return normalized as FinancialReceivableStatus;
}

function parseOptionalPayableStatus(
  value: unknown,
  field: string,
): FinancialPayableStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    !FINANCIAL_PAYABLE_STATUSES.includes(normalized as FinancialPayableStatus)
  ) {
    throw new BadRequestException(
      `${field} inválido. Use: ${FINANCIAL_PAYABLE_STATUSES.join(', ')}`,
    );
  }

  return normalized as FinancialPayableStatus;
}

function parseOptionalSettlementBatchStatus(
  value: unknown,
  field: string,
): FinancialSettlementBatchStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    !FINANCIAL_SETTLEMENT_BATCH_STATUSES.includes(
      normalized as FinancialSettlementBatchStatus,
    )
  ) {
    throw new BadRequestException(
      `${field} inválido. Use: ${FINANCIAL_SETTLEMENT_BATCH_STATUSES.join(', ')}`,
    );
  }

  return normalized as FinancialSettlementBatchStatus;
}

function parseOptionalSettlementType(
  value: unknown,
  field: string,
): FinancialSettlementType | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    !FINANCIAL_SETTLEMENT_TYPES.includes(normalized as FinancialSettlementType)
  ) {
    throw new BadRequestException(
      `${field} inválido. Use: ${FINANCIAL_SETTLEMENT_TYPES.join(', ')}`,
    );
  }

  return normalized as FinancialSettlementType;
}

function parseOptionalSettlementRule(
  value: unknown,
  field: string,
): FinancialSettlementRule | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    !FINANCIAL_SETTLEMENT_RULES.includes(normalized as FinancialSettlementRule)
  ) {
    throw new BadRequestException(
      `${field} inválido. Use: ${FINANCIAL_SETTLEMENT_RULES.join(', ')}`,
    );
  }

  return normalized as FinancialSettlementRule;
}
