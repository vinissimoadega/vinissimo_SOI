export type SupplierListFilters = {
  search?: string;
  isActive?: boolean;
};

export type SupplierRecord = {
  id: string;
  supplierCode: string | null;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierListResponse = {
  items: SupplierRecord[];
  filters: {
    search: string | null;
    isActive: boolean | null;
  };
};
