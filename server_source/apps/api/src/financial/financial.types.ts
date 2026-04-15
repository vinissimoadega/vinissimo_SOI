export const FINANCIAL_RECEIVABLE_STATUSES = [
  'previsto',
  'vencendo_hoje',
  'vencido',
  'recebido',
  'recebido_parcial',
  'cancelado',
] as const;

export const FINANCIAL_PAYABLE_STATUSES = [
  'previsto',
  'vencendo_hoje',
  'vencido',
  'pago',
  'pago_parcial',
  'cancelado',
] as const;

export const FINANCIAL_SETTLEMENT_BATCH_STATUSES = [
  'previsto',
  'recebido',
  'recebido_parcial',
  'divergente',
  'cancelado',
] as const;

export const FINANCIAL_SETTLEMENT_TYPES = [
  'immediate',
  'deferred',
  'marketplace_batch',
  'manual',
] as const;

export const FINANCIAL_SETTLEMENT_RULES = [
  'same_day',
  'next_day',
  'weekly_wednesday',
  'days_after_sale',
  'manual',
] as const;

export type FinancialReceivableStatus =
  (typeof FINANCIAL_RECEIVABLE_STATUSES)[number];

export type FinancialPayableStatus =
  (typeof FINANCIAL_PAYABLE_STATUSES)[number];

export type FinancialSettlementBatchStatus =
  (typeof FINANCIAL_SETTLEMENT_BATCH_STATUSES)[number];

export type FinancialSettlementType =
  (typeof FINANCIAL_SETTLEMENT_TYPES)[number];

export type FinancialSettlementRule =
  (typeof FINANCIAL_SETTLEMENT_RULES)[number];

export type FinancialReceivableListFilters = {
  search?: string;
  channelId?: string;
  status?: FinancialReceivableStatus;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

export type FinancialPayableListFilters = {
  search?: string;
  status?: FinancialPayableStatus;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

export type FinancialCashflowFilters = {
  windowDays: number;
  dateFrom?: string;
  dateTo?: string;
  channelId?: string;
  status?: FinancialReceivableStatus | FinancialPayableStatus;
  costNature?: 'fixed' | 'variable';
};

export type FinancialPnlFilters = {
  dateFrom?: string;
  dateTo?: string;
  channelId?: string;
};

export type FinancialSettlementFilters = {
  status?: FinancialSettlementBatchStatus;
  page: number;
  pageSize: number;
};

export type FinancialChannelRuleRecord = {
  id: string;
  channelId: string;
  channelKey: string;
  channelName: string;
  settlementType: FinancialSettlementType;
  expectedSettlementRule: FinancialSettlementRule;
  expectedDays: number | null;
  feePct: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialReceivableListItem = {
  id: string;
  receivableNumber: string;
  sourceType: 'sale' | 'manual_revenue' | 'settlement_batch';
  sourceLabel: string;
  sourceId: string | null;
  salesOrderId: string | null;
  saleNumber: string | null;
  channelId: string | null;
  channelKey: string | null;
  channelName: string | null;
  customerId: string | null;
  counterpartyName: string | null;
  grossAmount: string;
  netExpectedAmount: string;
  competencyDate: string;
  expectedReceiptDate: string;
  actualReceiptDate: string | null;
  amountReceived: string;
  status: FinancialReceivableStatus;
  notes: string | null;
  originHref: string | null;
  settlementBatchId: string | null;
  settlementBatchReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialPayableListItem = {
  id: string;
  payableNumber: string;
  sourceType: 'purchase' | 'expense' | 'manual';
  sourceLabel: string;
  sourceId: string | null;
  purchaseOrderId: string | null;
  purchaseNumber: string | null;
  expenseId: string | null;
  supplierId: string | null;
  supplierName: string | null;
  counterpartyName: string | null;
  category: string | null;
  costNature: 'fixed' | 'variable' | null;
  amount: string;
  competencyDate: string;
  dueDate: string;
  actualPaymentDate: string | null;
  amountPaid: string;
  paymentMethod: string | null;
  status: FinancialPayableStatus;
  notes: string | null;
  originHref: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialSettlementBatchRecord = {
  id: string;
  batchReference: string;
  channelId: string;
  channelKey: string;
  channelName: string;
  expectedSettlementRule: FinancialSettlementRule;
  competencyStart: string;
  competencyEnd: string;
  expectedReceiptDate: string;
  actualReceiptDate: string | null;
  expectedAmount: string;
  receivedAmount: string;
  status: FinancialSettlementBatchStatus;
  notes: string | null;
  linkedReceivablesCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FinancialOverviewCard = {
  label: string;
  value: string;
  helper?: string | null;
};

export type FinancialAlertItem = {
  id: string;
  title: string;
  description: string;
  tone: 'success' | 'warning' | 'high' | 'low';
};

export type FinancialOverviewResponse = {
  generatedAt: string;
  cards: {
    receivableToday: FinancialOverviewCard;
    payableToday: FinancialOverviewCard;
    predictedBalance7Days: FinancialOverviewCard;
    predictedBalance30Days: FinancialOverviewCard;
    ifoodSettlement: FinancialOverviewCard;
    overdueExpenses: FinancialOverviewCard;
    managementMargin: FinancialOverviewCard;
  };
  receivablesDue: FinancialReceivableListItem[];
  payablesDue: FinancialPayableListItem[];
  alerts: FinancialAlertItem[];
  cashflowSummary7Days: FinancialCashflowSummary;
  cashflowSummary30Days: FinancialCashflowSummary;
  pnlSummary: FinancialPnlSummary;
  settlementBatches: FinancialSettlementBatchRecord[];
  channelRules: FinancialChannelRuleRecord[];
};

export type FinancialCashflowSummary = {
  windowLabel: string;
  entriesExpected: string;
  exitsExpected: string;
  predictedBalance: string;
  entriesRealized: string;
  exitsRealized: string;
  realizedBalance: string;
};

export type FinancialCashflowBucket = {
  referenceDate: string;
  entriesExpected: string;
  exitsExpected: string;
  predictedBalance: string;
  entriesRealized: string;
  exitsRealized: string;
  realizedBalance: string;
};

export type FinancialCashflowResponse = {
  generatedAt: string;
  filters: {
    windowDays: number;
    dateFrom: string;
    dateTo: string;
    channelId: string | null;
    status: string | null;
    costNature: string | null;
  };
  meta: {
    channels: {
      id: string;
      channelKey: string;
      channelName: string;
      isActive: boolean;
    }[];
  };
  summary: FinancialCashflowSummary;
  buckets: FinancialCashflowBucket[];
};

export type FinancialPnlSummary = {
  grossRevenue: string;
  discountsAndFees: string;
  netRevenue: string;
  cogs: string;
  additionalSaleCosts: string;
  grossProfit: string;
  operatingExpenses: string;
  operatingResult: string;
  operatingMarginPct: string | null;
};

export type FinancialPnlChannelSummary = FinancialPnlSummary & {
  channelId: string;
  channelKey: string;
  channelName: string;
};

export type FinancialPnlResponse = {
  generatedAt: string;
  filters: {
    dateFrom: string;
    dateTo: string;
    channelId: string | null;
  };
  meta: {
    channels: {
      id: string;
      channelKey: string;
      channelName: string;
      isActive: boolean;
    }[];
  };
  summary: FinancialPnlSummary;
  channels: FinancialPnlChannelSummary[];
};

export type FinancialReceivablesResponse = {
  items: FinancialReceivableListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    channelId: string | null;
    status: FinancialReceivableStatus | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  meta: {
    channels: {
      id: string;
      channelKey: string;
      channelName: string;
      isActive: boolean;
    }[];
    availableStatuses: FinancialReceivableStatus[];
  };
};

export type FinancialPayablesResponse = {
  items: FinancialPayableListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    supplierId: string | null;
    status: FinancialPayableStatus | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  meta: {
    suppliers: {
      id: string;
      supplierCode: string | null;
      name: string;
      isActive: boolean;
    }[];
    availableStatuses: FinancialPayableStatus[];
  };
};

export type FinancialSettlementsResponse = {
  items: FinancialSettlementBatchRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    status: FinancialSettlementBatchStatus | null;
  };
  meta: {
    availableStatuses: FinancialSettlementBatchStatus[];
    channelRules: FinancialChannelRuleRecord[];
  };
};
