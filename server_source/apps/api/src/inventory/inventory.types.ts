export const STOCK_STATUSES = ['ruptura', 'repor_agora', 'atencao', 'ok'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const INVENTORY_MOVEMENT_TYPES = [
  'initial_stock',
  'purchase_in',
  'sale_out',
  'adjustment',
  'cancel_reversal',
  'return_in',
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export type InventoryStatusFilters = {
  search?: string;
  categoryId?: string;
  stockStatus?: StockStatus;
  page: number;
  pageSize: number;
};

export type InventoryMovementFilters = {
  productId?: string;
  movementType?: InventoryMovementType;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

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
  stockStatus: StockStatus;
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
    stockStatus: StockStatus | null;
  };
  meta: {
    categories: InventoryCategoryOption[];
    availableStatuses: StockStatus[];
    currentSettings: {
      replenishmentLeadTimeDays: number;
      stockSafetyDays: number;
    };
  };
};

export type InventoryMovementRecord = {
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
  items: InventoryMovementRecord[];
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
  channelKey: 'whatsapp' | 'instagram' | 'ifood' | 'balcao';
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
