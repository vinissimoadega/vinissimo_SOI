export const EXPENSE_COST_NATURES = ['fixed', 'variable'] as const;
export const EXPENSE_PAYMENT_METHODS = [
  'cash',
  'pix',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'other',
] as const;

export type ExpenseCostNature = (typeof EXPENSE_COST_NATURES)[number];
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export type ExpenseListFilters = {
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
};

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
