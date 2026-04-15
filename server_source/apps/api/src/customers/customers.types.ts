export const CUSTOMER_STATUSES = [
  'lead',
  'novo',
  'recorrente',
  'inativo',
] as const;

export const CUSTOMER_INTERACTION_TYPES = [
  'followup_pending',
  'post_sale_due',
  'review_request_due',
  'reactivation_due',
  'manual_action_due',
  'post_sale',
  'review_request',
  'reactivation',
  'other',
] as const;

export const CUSTOMER_INTERACTION_STATUSES = [
  'pending',
  'done',
  'no_response',
  'dispensed',
  'ignored',
  'attempt_open',
  'reactivated',
] as const;

export const CUSTOMER_INTERACTION_PRIORITIES = [
  'high',
  'medium',
  'low',
] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type CustomerInteractionType = (typeof CUSTOMER_INTERACTION_TYPES)[number];
export type CustomerInteractionStatus =
  (typeof CUSTOMER_INTERACTION_STATUSES)[number];
export type CustomerInteractionPriority =
  (typeof CUSTOMER_INTERACTION_PRIORITIES)[number];

export type CustomerListFilters = {
  search?: string;
  customerStatus?: CustomerStatus;
  channelId?: string;
  page: number;
  pageSize: number;
};

export type CustomerChannelRecord = {
  id: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
};

export type CustomerRecord = {
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

export type CustomerPreferenceRecord = {
  id: string;
  customerId: string;
  preferenceType: string;
  preferenceValue: string;
  source: string | null;
  createdAt: string;
};

export type CustomerInteractionRecord = {
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
