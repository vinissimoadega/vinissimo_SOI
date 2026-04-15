import {
  CustomerInteractionPriority,
  CustomerInteractionStatus,
  CustomerInteractionType,
  CustomerStatus,
} from '../customers/customers.types';

export type CrmTaskType = CustomerInteractionType;
export type CrmTaskStatus = CustomerInteractionStatus;
export type CrmTaskPriority = CustomerInteractionPriority;

export const CRM_QUEUE_TASK_TYPES = [
  'followup_pending',
  'post_sale_due',
  'review_request_due',
  'reactivation_due',
  'manual_action_due',
] as const;

export const CRM_OPEN_TASK_STATUSES = ['pending', 'attempt_open'] as const;
export const CRM_TERMINAL_TASK_STATUSES = [
  'done',
  'no_response',
  'dispensed',
  'ignored',
  'reactivated',
] as const;

export type CrmQueueFilters = {
  taskType?: CrmTaskType;
  taskStatus?: CrmTaskStatus;
  customerId?: string;
  onlyOverdue?: boolean;
  page: number;
  pageSize: number;
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
  taskType: CrmTaskType;
  taskStatus: CrmTaskStatus;
  priority: CrmTaskPriority;
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
  orderStatus: string;
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
    taskType: CrmTaskType | null;
    taskStatus: CrmTaskStatus | null;
    customerId: string | null;
    onlyOverdue: boolean | null;
  };
};

export type CrmCustomerSale = {
  id: string;
  saleNumber: string;
  saleDate: string;
  channelName: string;
  orderStatus: string;
  grossRevenue: string;
  netRevenue: string;
  grossProfit: string;
};

export type CrmSuggestedAction = {
  label: string;
  reason: string;
  dueAt: string | null;
  taskId: string | null;
  taskType: CrmTaskType | null;
  taskStatus: CrmTaskStatus | null;
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
