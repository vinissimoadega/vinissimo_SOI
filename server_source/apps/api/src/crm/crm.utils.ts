import { BadRequestException } from '@nestjs/common';
import {
  parseOptionalBoolean,
  parseOptionalText,
  parseOptionalTimestamp,
  parseOptionalUuid,
  parsePositiveInteger,
  parseRequiredInteractionType,
  parseRequiredText,
  parseRequiredUuid,
  parseOptionalInteractionPriority,
  parseOptionalInteractionStatus,
} from '../customers/customers.utils';
import {
  CRM_QUEUE_TASK_TYPES,
  CrmQueueFilters,
  CrmTaskPriority,
  CrmTaskStatus,
  CrmTaskType,
} from './crm.types';

export function parseCrmQueueFilters(
  query: Record<string, string | undefined>,
): CrmQueueFilters {
  return {
    taskType: parseOptionalTaskType(query.task_type, 'task_type') ?? undefined,
    taskStatus:
      parseOptionalInteractionStatus(query.task_status, 'task_status') ?? undefined,
    customerId: parseOptionalUuid(query.customer_id, 'customer_id') ?? undefined,
    onlyOverdue:
      parseOptionalBoolean(query.only_overdue, 'only_overdue') ?? undefined,
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.page_size, 'page_size', 20, 100),
  };
}

export function parseCrmTaskCreatePayload(body: Record<string, unknown>) {
  const dueAt = parseOptionalTimestamp(body.dueAt, 'dueAt');
  const completedAt = parseOptionalTimestamp(body.completedAt, 'completedAt');
  const taskStatus =
    parseOptionalInteractionStatus(body.taskStatus, 'taskStatus') ??
    (completedAt ? 'done' : 'pending');

  if (
    (taskStatus === 'pending' || taskStatus === 'attempt_open') &&
    completedAt
  ) {
    throw new BadRequestException(
      'completedAt só pode ser usado quando a tarefa estiver em status final',
    );
  }

  return {
    customerId: parseRequiredUuid(body.customerId, 'customerId'),
    salesOrderId: parseOptionalUuid(body.salesOrderId, 'salesOrderId') ?? null,
    taskType: parseRequiredInteractionType(body.taskType, 'taskType'),
    taskStatus,
    priority:
      parseOptionalInteractionPriority(body.priority, 'priority') ?? 'medium',
    reason: parseRequiredText(body.reason, 'reason', 240),
    notes: parseOptionalText(body.notes, 'notes', 1500) ?? null,
    dueAt: dueAt ?? null,
    completedAt: completedAt ?? null,
    ownerUserId: parseOptionalUuid(body.ownerUserId, 'ownerUserId') ?? null,
  };
}

export function parseCrmTaskUpdatePayload(body: Record<string, unknown>) {
  const patch: {
    taskStatus?: CrmTaskStatus;
    priority?: CrmTaskPriority;
    reason?: string | null;
    notes?: string | null;
    dueAt?: string | null;
    completedAt?: string | null;
    ownerUserId?: string | null;
  } = {};

  const taskStatus = parseOptionalInteractionStatus(body.taskStatus, 'taskStatus');
  if (taskStatus !== undefined) {
    patch.taskStatus = taskStatus ?? 'pending';
  }

  const priority = parseOptionalInteractionPriority(body.priority, 'priority');
  if (priority !== undefined) {
    patch.priority = priority ?? 'medium';
  }

  const reason = parseOptionalText(body.reason, 'reason', 240);
  if (reason !== undefined) {
    if (reason === null) {
      throw new BadRequestException('reason não pode ser vazio');
    }
    patch.reason = reason;
  }

  const notes = parseOptionalText(body.notes, 'notes', 1500);
  if (notes !== undefined) {
    patch.notes = notes;
  }

  const dueAt = parseOptionalTimestamp(body.dueAt, 'dueAt');
  if (dueAt !== undefined) {
    patch.dueAt = dueAt;
  }

  const completedAt = parseOptionalTimestamp(body.completedAt, 'completedAt');
  if (completedAt !== undefined) {
    patch.completedAt = completedAt;
  }

  const ownerUserId = parseOptionalUuid(body.ownerUserId, 'ownerUserId');
  if (ownerUserId !== undefined) {
    patch.ownerUserId = ownerUserId;
  }

  if (Object.keys(patch).length === 0) {
    throw new BadRequestException('Nenhum campo válido foi enviado para atualização');
  }

  return patch;
}

export function isOpenCrmTaskStatus(status: CrmTaskStatus) {
  return status === 'pending' || status === 'attempt_open';
}

export function parseOptionalTaskType(
  value: unknown,
  field: string,
): CrmTaskType | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredInteractionType(value, field);
}

export function isQueueTaskType(taskType: CrmTaskType) {
  return CRM_QUEUE_TASK_TYPES.includes(taskType as (typeof CRM_QUEUE_TASK_TYPES)[number]);
}
