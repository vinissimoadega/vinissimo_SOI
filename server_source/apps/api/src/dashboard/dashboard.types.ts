export type DashboardAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DashboardStockStatus = 'ruptura' | 'repor_agora' | 'atencao' | 'ok';
export type DashboardCustomerStatus =
  | 'lead'
  | 'novo'
  | 'recorrente'
  | 'inativo';

export type DashboardExecutiveSummary = {
  grossRevenue: string;
  netRevenue: string;
  grossProfit: string;
  grossMarginPct: string | null;
  deliveredOrdersCount: number;
};

export type DashboardStockSummary = {
  totalStockValue: string;
  rupturaCount: number;
  reporAgoraCount: number;
  atencaoCount: number;
  okCount: number;
};

export type DashboardChannelSummary = {
  channelId: string;
  channelKey: string;
  channelName: string;
  ordersCount: number;
  grossRevenue: string;
  netRevenue: string;
  grossProfit: string;
  grossMarginPct: string | null;
};

export type DashboardCustomerSummary = {
  leadCount: number;
  novoCount: number;
  recorrenteCount: number;
  inativoCount: number;
  totalActiveCustomers: number;
};

export type DashboardStockAlertItem = {
  productId: string;
  sku: string;
  name: string;
  currentStockQty: string;
  usedMinStockQty: string;
  coverageDays: string | null;
  stockStatus: DashboardStockStatus;
  suggestedPurchaseQty: string;
  tiedUpCapital: string;
};

export type DashboardAlert = {
  id: string;
  severity: DashboardAlertSeverity;
  title: string;
  message: string;
  entity: string;
  href: string;
};

export type DashboardPendingBaseItem = {
  sku: string | null;
  name: string;
  reason: string;
  source: string;
};

export type DashboardBaseCoverage = {
  realProducts: number;
  productsWithCost: number;
  productsWithoutCost: number;
};

export type DashboardOverviewResponse = {
  generatedAt: string;
  executiveSummary: DashboardExecutiveSummary;
  stockSummary: DashboardStockSummary;
  channelSummary: DashboardChannelSummary[];
  customerSummary: DashboardCustomerSummary;
  criticalStock: DashboardStockAlertItem[];
  alerts: DashboardAlert[];
  pendingBase: {
    totalItems: number;
    items: DashboardPendingBaseItem[];
    note: string;
  };
  baseCoverage: DashboardBaseCoverage;
};
