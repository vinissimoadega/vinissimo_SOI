export const SALE_ORDER_STATUSES = ['pending', 'delivered', 'canceled'] as const;
export const SALE_PAYMENT_STATUSES = [
  'unpaid',
  'pending_confirmation',
  'paid',
  'failed',
  'refunded',
] as const;
export const SALE_ADDITIONAL_COST_TYPES = [
  'custom_card',
  'special_packaging',
  'subsidized_shipping',
  'extra_delivery',
  'other',
] as const;

export type SaleOrderStatus = (typeof SALE_ORDER_STATUSES)[number];
export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number];
export type SaleAdditionalCostType =
  (typeof SALE_ADDITIONAL_COST_TYPES)[number];

export type SaleListFilters = {
  search?: string;
  channelId?: string;
  customerId?: string;
  productId?: string;
  orderStatus?: SaleOrderStatus;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

export type SalePricingPolicy = {
  marginMinTarget: string;
  feeWhatsapp: string;
  feeInstagram: string;
  feeIfood: string;
  feeCounter: string;
};

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

export type SaleItemRecord = {
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

export type SaleAdditionalCostRecord = {
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

export type SaleDetailRecord = SaleListItem & {
  items: SaleItemRecord[];
  additionalCosts: SaleAdditionalCostRecord[];
};
