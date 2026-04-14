import { BadRequestException } from '@nestjs/common';
import {
  INVENTORY_MOVEMENT_TYPES,
  InventoryMovementFilters,
  InventoryMovementType,
  InventoryStatusFilters,
  STOCK_STATUSES,
  StockStatus,
} from './inventory.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseInventoryStatusFilters(
  query: Record<string, string | undefined>,
): InventoryStatusFilters {
  return {
    search: parseOptionalText(query.search, 'search', 120) ?? undefined,
    categoryId: parseOptionalUuid(query.category_id, 'category_id') ?? undefined,
    stockStatus:
      parseOptionalStockStatus(query.stock_status, 'stock_status') ?? undefined,
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.page_size, 'page_size', 12, 50),
  };
}

export function parseInventoryMovementFilters(
  query: Record<string, string | undefined>,
): InventoryMovementFilters {
  return {
    productId: parseOptionalUuid(query.product_id, 'product_id') ?? undefined,
    movementType:
      parseOptionalMovementType(query.movement_type, 'movement_type') ?? undefined,
    dateFrom: parseOptionalDateFilter(query.date_from, 'date_from') ?? undefined,
    dateTo: parseOptionalDateFilter(query.date_to, 'date_to') ?? undefined,
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

export function parseOptionalDateFilter(
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const timestamp = new Date(normalized);

  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException(`${field} inválido`);
  }

  return timestamp.toISOString().slice(0, 10);
}

export function parseRequiredMovementDate(value: unknown, field: string): string {
  const normalized = trimString(value);

  if (!normalized) {
    return new Date().toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T12:00:00.000Z`).toISOString();
  }

  const timestamp = new Date(normalized);

  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException(`${field} inválido`);
  }

  return timestamp.toISOString();
}

export function parseSignedNonZeroDecimal(value: unknown, field: string): string {
  const normalized = trimString(value).replace(',', '.');

  if (!normalized) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount === 0) {
    throw new BadRequestException(`${field} deve ser numérico e diferente de zero`);
  }

  return amount.toFixed(2);
}

export function parseUnsignedDecimalAllowZero(
  value: unknown,
  field: string,
): string {
  const normalized = trimString(value).replace(',', '.');

  if (!normalized) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new BadRequestException(`${field} deve ser numérico e não negativo`);
  }

  return amount.toFixed(2);
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

  const normalized = Number(trimString(value));

  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new BadRequestException(`${field} deve ser um inteiro positivo`);
  }

  if (normalized > maxValue) {
    throw new BadRequestException(`${field} excede o máximo permitido de ${maxValue}`);
  }

  return normalized;
}

export function parseOptionalStockStatus(
  value: unknown,
  field: string,
): StockStatus | null | undefined {
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

  if (!STOCK_STATUSES.includes(normalized as StockStatus)) {
    throw new BadRequestException(
      `${field} inválido. Use: ${STOCK_STATUSES.join(', ')}`,
    );
  }

  return normalized as StockStatus;
}

export function parseOptionalMovementType(
  value: unknown,
  field: string,
): InventoryMovementType | null | undefined {
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

  if (!INVENTORY_MOVEMENT_TYPES.includes(normalized as InventoryMovementType)) {
    throw new BadRequestException(
      `${field} inválido. Use: ${INVENTORY_MOVEMENT_TYPES.join(', ')}`,
    );
  }

  return normalized as InventoryMovementType;
}
