export type PurchaseListFilters = {
  search?: string;
  supplierId?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
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

export type PurchaseItemRecord = {
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

export type PurchaseDetailRecord = PurchaseListItem & {
  items: PurchaseItemRecord[];
};
