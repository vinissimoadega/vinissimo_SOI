import { BadRequestException } from '@nestjs/common';
import {
  CUSTOMER_INTERACTION_PRIORITIES,
  CUSTOMER_INTERACTION_STATUSES,
  CUSTOMER_INTERACTION_TYPES,
  CUSTOMER_STATUSES,
  CustomerInteractionPriority,
  CustomerInteractionStatus,
  CustomerInteractionType,
  CustomerListFilters,
  CustomerStatus,
} from './customers.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCustomerListFilters(
  query: Record<string, string | undefined>,
): CustomerListFilters {
  return {
    search: parseOptionalSearch(query.search),
    customerStatus:
      parseOptionalCustomerStatus(query.customer_status, 'customer_status') ??
      undefined,
    channelId: parseOptionalUuid(query.channel_id, 'channel_id') ?? undefined,
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.page_size, 'page_size', 12, 50),
  };
}

export function parseRequiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  const normalized = trimString(value);

  if (!normalized) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} excede o limite de ${maxLength} caracteres`);
  }

  return normalized;
}

export function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value);

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} excede o limite de ${maxLength} caracteres`);
  }

  return normalized;
}

export function parseOptionalEmail(value: unknown, field: string) {
  const normalized = parseOptionalText(value, field, 160);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalized)) {
    throw new BadRequestException(`${field} inválido`);
  }

  return normalized.toLowerCase();
}

export function parseOptionalUuid(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value);

  if (!normalized) {
    return null;
  }

  if (!UUID_PATTERN.test(normalized)) {
    throw new BadRequestException(`${field} inválido`);
  }

  return normalized;
}

export function parseRequiredUuid(value: unknown, field: string): string {
  const normalized = parseOptionalUuid(value, field);

  if (!normalized) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  return normalized;
}

export function parseBooleanInput(value: unknown, field: string): boolean {
  const normalized = parseOptionalBoolean(value, field);

  if (normalized === null || normalized === undefined) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  return normalized;
}

export function parseOptionalBoolean(
  value: unknown,
  field: string,
): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = trimString(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new BadRequestException(`${field} deve ser true ou false`);
}

export function parseOptionalTimestamp(
  value: unknown,
  field: string,
): string | null | undefined {
  const normalized = parseOptionalText(value, field, 80);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  const timestamp = new Date(normalized);

  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException(`${field} inválido`);
  }

  return timestamp.toISOString();
}

export function parseOptionalCustomerStatus(
  value: unknown,
  field: string,
): CustomerStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (!CUSTOMER_STATUSES.includes(normalized as CustomerStatus)) {
    throw new BadRequestException(
      `${field} deve ser um dos valores: ${CUSTOMER_STATUSES.join(', ')}`,
    );
  }

  return normalized as CustomerStatus;
}

export function parseRequiredInteractionType(
  value: unknown,
  field: string,
): CustomerInteractionType {
  const normalized = parseRequiredText(value, field, 80).toLowerCase();

  if (!CUSTOMER_INTERACTION_TYPES.includes(normalized as CustomerInteractionType)) {
    throw new BadRequestException(
      `${field} deve ser um dos valores: ${CUSTOMER_INTERACTION_TYPES.join(', ')}`,
    );
  }

  return normalized as CustomerInteractionType;
}

export function parseOptionalInteractionStatus(
  value: unknown,
  field: string,
): CustomerInteractionStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    !CUSTOMER_INTERACTION_STATUSES.includes(
      normalized as CustomerInteractionStatus,
    )
  ) {
    throw new BadRequestException(
      `${field} deve ser um dos valores: ${CUSTOMER_INTERACTION_STATUSES.join(', ')}`,
    );
  }

  return normalized as CustomerInteractionStatus;
}

export function parseOptionalInteractionPriority(
  value: unknown,
  field: string,
): CustomerInteractionPriority | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    !CUSTOMER_INTERACTION_PRIORITIES.includes(
      normalized as CustomerInteractionPriority,
    )
  ) {
    throw new BadRequestException(
      `${field} deve ser um dos valores: ${CUSTOMER_INTERACTION_PRIORITIES.join(', ')}`,
    );
  }

  return normalized as CustomerInteractionPriority;
}

export function parsePositiveInteger(
  value: unknown,
  field: string,
  fallback: number,
  maxValue = 100,
): number {
  if (value === undefined || value === null || trimString(value) === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxValue) {
    throw new BadRequestException(
      `${field} deve ser um inteiro entre 1 e ${maxValue}`,
    );
  }

  return parsed;
}

function parseOptionalSearch(value: unknown): string | undefined {
  const normalized = trimString(value);

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > 120) {
    throw new BadRequestException('search excede o limite de 120 caracteres');
  }

  return normalized;
}
