export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
  database: {
    current_database: string;
    current_user: string;
  };
};

export type CurrentSettings = {
  id: string;
  margin_min_target: string;
  replenishment_lead_time_days: number;
  stock_safety_days: number;
  customer_inactive_days: number;
  fee_whatsapp: string;
  fee_instagram: string;
  fee_ifood: string;
  fee_counter: string;
  fixed_monthly_expense_estimate: string;
  avg_packaging_unit_cost: string;
  effective_from: string;
  is_current: boolean;
  created_at: string;
  created_by: string | null;
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: string[];
};

export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productCount: number;
  createdAt: string;
};

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  countryName: string | null;
  regionName: string | null;
  grapeComposition: string | null;
  wineDescription: string | null;
  baseUnitCost: string | null;
  currentUnitCost: string | null;
  initialStockQty: string;
  minStockManualQty: string | null;
  isActive: boolean;
  notes: string | null;
  channelPricesCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductListResponse = {
  items: ProductListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    categoryId: string | null;
    isActive: boolean | null;
  };
};

export type ProductSkuLookupItem = {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  countryName: string | null;
  regionName: string | null;
  grapeComposition: string | null;
  currentUnitCost: string | null;
  currentStockQty: string;
};

export type ProductSkuLookupResponse = {
  sku: string;
  found: boolean;
  product: ProductSkuLookupItem | null;
};

export type ProductChannelPrice = {
  priceId: string | null;
  channelId: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
  targetPrice: string | null;
  updatedAt: string | null;
};

export type ProductChannelPricesResponse = {
  productId: string;
  prices: ProductChannelPrice[];
};

export type ProductCategoriesResponse = {
  items: ProductCategory[];
};

export type ChannelOption = {
  id: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
};

export type CustomerStatus = "lead" | "novo" | "recorrente" | "inativo";
export type CustomerInteractionType =
  | "followup_pending"
  | "post_sale_due"
  | "review_request_due"
  | "reactivation_due"
  | "manual_action_due"
  | "post_sale"
  | "review_request"
  | "reactivation"
  | "other";

export type CustomerInteractionStatus =
  | "pending"
  | "done"
  | "no_response"
  | "dispensed"
  | "ignored"
  | "attempt_open"
  | "reactivated";

export type CustomerInteractionPriority = "high" | "medium" | "low";

export type CustomerListItem = {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  acquisitionChannelId: string | null;
  acquisitionChannelKey: string | null;
  acquisitionChannelName: string | null;
  notes: string | null;
  isActive: boolean;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  ordersCount: number;
  totalRevenue: string;
  avgTicket: string | null;
  customerStatus: CustomerStatus;
  calculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListResponse = {
  items: CustomerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    customerStatus: CustomerStatus | null;
    channelId: string | null;
  };
  meta: {
    channels: ChannelOption[];
    availableStatuses: CustomerStatus[];
  };
};

export type CustomerPreference = {
  id: string;
  customerId: string;
  preferenceType: string;
  preferenceValue: string;
  source: string | null;
  createdAt: string;
};

export type CustomerPreferencesResponse = {
  customerId: string;
  items: CustomerPreference[];
};

export type CustomerInteraction = {
  id: string;
  customerId: string;
  interactionType: CustomerInteractionType;
  salesOrderId: string | null;
  saleNumber: string | null;
  reason: string;
  interactionStatus: CustomerInteractionStatus;
  priority: CustomerInteractionPriority;
  scheduledFor: string | null;
  completedAt: string | null;
  notes: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInteractionsResponse = {
  customerId: string;
  items: CustomerInteraction[];
};

export type CrmQueueItem = {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerStatus: CustomerStatus;
  salesOrderId: string | null;
  saleNumber: string | null;
  saleDate: string | null;
  channelName: string | null;
  taskType: CustomerInteractionType;
  taskStatus: CustomerInteractionStatus;
  priority: CustomerInteractionPriority;
  reason: string;
  notes: string | null;
  dueAt: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isOverdue: boolean;
};

export type CrmRecurringCustomer = {
  customerId: string;
  customerName: string;
  ordersCount: number;
  totalRevenue: string;
  avgTicket: string | null;
  lastPurchaseAt: string | null;
};

export type CrmCustomerOption = {
  id: string;
  fullName: string;
  customerStatus: CustomerStatus;
  phone: string | null;
  email: string | null;
};

export type CrmSaleOption = {
  id: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string | null;
  saleDate: string;
  orderStatus: SaleOrderStatus;
};

export type CrmOverviewSummary = {
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

export type CrmOverviewResponse = {
  generatedAt: string;
  summary: CrmOverviewSummary;
  queue: CrmQueueItem[];
  recurringCustomers: CrmRecurringCustomer[];
  meta: {
    customers: CrmCustomerOption[];
    sales: CrmSaleOption[];
  };
};

export type CrmQueueResponse = {
  items: CrmQueueItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    taskType: CustomerInteractionType | null;
    taskStatus: CustomerInteractionStatus | null;
    customerId: string | null;
    onlyOverdue: boolean | null;
  };
};

export type CrmCustomerSale = {
  id: string;
  saleNumber: string;
  saleDate: string;
  channelName: string;
  orderStatus: SaleOrderStatus;
  grossRevenue: string;
  netRevenue: string;
  grossProfit: string;
};

export type CrmSuggestedAction = {
  label: string;
  reason: string;
  dueAt: string | null;
  taskId: string | null;
  taskType: CustomerInteractionType | null;
  taskStatus: CustomerInteractionStatus | null;
};

export type CrmCustomerMemoryResponse = {
  customer: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    primaryChannelName: string | null;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
    ordersCount: number;
    totalRevenue: string;
    avgTicket: string | null;
    customerStatus: CustomerStatus;
    notes: string | null;
  };
  preferences: {
    highlights: Array<{ id: string; label: string; value: string; source: string | null }>;
    objections: Array<{ id: string; label: string; value: string; source: string | null }>;
    occasions: Array<{ id: string; label: string; value: string; source: string | null }>;
    contexts: Array<{ id: string; label: string; value: string; source: string | null }>;
  };
  recentSales: CrmCustomerSale[];
  recentTasks: CrmQueueItem[];
  lastInteraction: CrmQueueItem | null;
  nextSuggestedAction: CrmSuggestedAction | null;
};

export type KpiCardData = {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success" | "warning";
  helper?: string;
};

export type AlertItem = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  entity: string;
  href: string;
};

export type ChannelPerformance = {
  channel: string;
  pedidos: number;
  receita: string;
  lucro: string;
  ticket: string;
  margem: string;
};

export type StockCriticalItem = {
  sku: string;
  produto: string;
  estoque: string;
  minimo: string;
  cobertura: string;
  status: "ruptura" | "repor_agora" | "atencao" | "ok";
};

export type CustomerAttentionItem = {
  nome: string;
  status: "lead" | "novo" | "recorrente" | "inativo";
  ultimaCompra: string;
  ticket: string;
};

export type PurchaseSupplierOption = {
  id: string;
  supplierCode: string | null;
  name: string;
  isActive: boolean;
};

export type PurchaseProductOption = {
  id: string;
  sku: string;
  name: string;
  currentUnitCost: string | null;
  baseUnitCost: string | null;
  isActive: boolean;
};

export type PurchaseListItem = {
  id: string;
  purchaseNumber: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  purchaseDate: string;
  notes: string | null;
  totalAmount: string;
  itemsCount: number;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
};

export type PurchaseItem = {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: string;
  unitCost: string;
  freightAllocated: string;
  extraCostAllocated: string;
  totalCost: string;
  realUnitCost: string;
  createdAt: string;
};

export type PurchaseDetail = PurchaseListItem & {
  items: PurchaseItem[];
};

export type PurchaseListResponse = {
  items: PurchaseListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    supplierId: string | null;
    productId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  meta: {
    suppliers: PurchaseSupplierOption[];
    products: PurchaseProductOption[];
  };
};

export type SaleOrderStatus = "pending" | "delivered" | "canceled";
export type SalePaymentStatus =
  | "unpaid"
  | "pending_confirmation"
  | "paid"
  | "failed"
  | "refunded";
export type SaleAdditionalCostType =
  | "custom_card"
  | "special_packaging"
  | "subsidized_shipping"
  | "extra_delivery"
  | "other";

export type SaleChannelOption = {
  id: string;
  channelKey: string;
  channelName: string;
  feePct: string;
  isActive: boolean;
};

export type SaleCustomerOption = {
  id: string;
  customerCode: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

export type SaleProductOption = {
  id: string;
  sku: string;
  name: string;
  currentUnitCost: string;
  isActive: boolean;
};

export type SaleListItem = {
  id: string;
  saleNumber: string;
  saleDate: string;
  customerId: string | null;
  customerName: string | null;
  channelId: string;
  channelKey: string;
  channelName: string;
  orderStatus: SaleOrderStatus;
  paymentStatus: SalePaymentStatus;
  externalChargeReference: string | null;
  paymentNotes: string | null;
  additionalCostTotal: string;
  grossRevenue: string;
  netRevenue: string;
  grossProfit: string;
  grossMarginPct: string | null;
  notes: string | null;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByName: string | null;
};

export type SaleItem = {
  id: string;
  salesOrderId: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
  grossRevenue: string;
  channelFeePct: string;
  netRevenue: string;
  costUnit: string;
  totalCost: string;
  grossProfit: string;
  grossMarginPct: string | null;
  belowMinPriceFlag: boolean;
  createdAt: string;
};

export type SaleAdditionalCost = {
  id: string;
  salesOrderId: string;
  costType: SaleAdditionalCostType;
  description: string;
  amount: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
};

export type SaleDetail = SaleListItem & {
  items: SaleItem[];
  additionalCosts: SaleAdditionalCost[];
};

export type SaleListResponse = {
  items: SaleListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    channelId: string | null;
    customerId: string | null;
    productId: string | null;
    orderStatus: SaleOrderStatus | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  meta: {
    channels: SaleChannelOption[];
    customers: SaleCustomerOption[];
    products: SaleProductOption[];
    availableStatuses: SaleOrderStatus[];
    pricingPolicy: {
      marginMinTarget: string;
    };
  };
};

export type ExpenseCostNature = "fixed" | "variable";
export type ExpensePaymentMethod =
  | "cash"
  | "pix"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "other";

export type ExpenseChannelOption = {
  id: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
};

export type ExpenseListItem = {
  id: string;
  expenseDate: string;
  expenseType: string;
  category: string | null;
  description: string | null;
  amount: string;
  channelId: string | null;
  channelName: string | null;
  costNature: ExpenseCostNature;
  paymentMethod: ExpensePaymentMethod;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  createdByName: string | null;
};

export type ExpenseListResponse = {
  items: ExpenseListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    category: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  meta: {
    categories: string[];
    channels: ExpenseChannelOption[];
    availableCostNatures: ExpenseCostNature[];
    availablePaymentMethods: ExpensePaymentMethod[];
  };
};

export type InventoryStockStatus =
  | "ruptura"
  | "repor_agora"
  | "atencao"
  | "ok";

export type InventoryMovementType =
  | "initial_stock"
  | "purchase_in"
  | "sale_out"
  | "adjustment"
  | "cancel_reversal"
  | "return_in";

export type InventoryCategoryOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export type InventoryProductOption = {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  currentUnitCost: string;
  currentStockQty: string;
};

export type InventoryStatusItem = {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  isActive: boolean;
  currentUnitCost: string;
  currentStockQty: string;
  manualMinStockQty: string;
  avgDailySalesQty: string;
  replenishmentLeadTimeDays: number;
  stockSafetyDays: number;
  suggestedMinStockQty: string;
  usedMinStockQty: string;
  coverageDays: string | null;
  stockStatus: InventoryStockStatus;
  suggestedPurchaseQty: string;
  tiedUpCapital: string;
};

export type InventoryStatusResponse = {
  items: InventoryStatusItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    search: string | null;
    categoryId: string | null;
    stockStatus: InventoryStockStatus | null;
  };
  meta: {
    categories: InventoryCategoryOption[];
    availableStatuses: InventoryStockStatus[];
    currentSettings: {
      replenishmentLeadTimeDays: number;
      stockSafetyDays: number;
    };
  };
};

export type InventoryMovementItem = {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  movementType: InventoryMovementType;
  movementDate: string;
  quantityDelta: string;
  unitCostReference: string | null;
  sourceType: string | null;
  sourceId: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
};

export type InventoryMovementsResponse = {
  items: InventoryMovementItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: {
    productId: string | null;
    movementType: InventoryMovementType | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  meta: {
    products: InventoryProductOption[];
    availableMovementTypes: InventoryMovementType[];
  };
};

export type InventoryMinPriceRow = {
  channelKey: "whatsapp" | "instagram" | "ifood" | "balcao";
  channelName: string;
  feePct: string;
  marginMinTarget: string;
  currentUnitCost: string;
  minimumPrice: string | null;
};

export type InventoryMinPricesResponse = {
  productId: string;
  sku: string;
  name: string;
  currentUnitCost: string;
  marginMinTarget: string;
  prices: InventoryMinPriceRow[];
};

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

export type DashboardCriticalStockItem = {
  productId: string;
  sku: string;
  name: string;
  currentStockQty: string;
  usedMinStockQty: string;
  coverageDays: string | null;
  stockStatus: InventoryStockStatus;
  suggestedPurchaseQty: string;
  tiedUpCapital: string;
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
  criticalStock: DashboardCriticalStockItem[];
  alerts: AlertItem[];
  pendingBase: {
    totalItems: number;
    items: DashboardPendingBaseItem[];
    note: string;
  };
  baseCoverage: DashboardBaseCoverage;
};
