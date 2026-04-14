export type ProductListFilters = {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
};

export type ProductRecord = {
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

export type ProductSkuLookupRecord = {
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

export type ProductCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productCount: number;
  createdAt: string;
};

export type ProductChannelPriceRecord = {
  priceId: string | null;
  channelId: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
  targetPrice: string | null;
  updatedAt: string | null;
};
