import { BadRequestException } from '@nestjs/common';
import { PurchaseListFilters } from './purchases.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parsePurchaseListFilters(
  query: Record<string, string | undefined>,
): PurchaseListFilters {
  return {
    search: parseOptionalSearch(query.search) ?? undefined,
    supplierId: parseOptionalUuid(query.supplier_id, 'supplier_id') ?? undefined,
    productId: parseOptionalUuid(query.product_id, 'product_id') ?? undefined,
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

export function parseRequiredMoney(
  value: unknown,
  field: string,
): string {
  const normalized = parseOptionalMoney(value, field);

  if (normalized === undefined || normalized === null) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  return normalized;
}

export function parseOptionalMoney(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = trimString(value).replace(',', '.');

  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new BadRequestException(`${field} deve ser numérico e não negativo`);
  }

  return amount.toFixed(2);
}

export function parseRequiredPositiveDecimal(
  value: unknown,
  field: string,
): string {
  const normalized = trimString(value).replace(',', '.');

  if (!normalized) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException(`${field} deve ser numérico e maior que zero`);
  }

  return amount.toFixed(2);
}

export function parseRequiredPurchaseDate(
  value: unknown,
  field: string,
): string {
  const normalized = parseRequiredText(value, field, 80);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T12:00:00.000Z`).toISOString();
  }

  const timestamp = new Date(normalized);

  if (Number.isNaN(timestamp.getTime())) {
    throw new BadRequestException(`${field} inválido`);
  }

  return timestamp.toISOString();
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

export function parseOptionalSearch(value: unknown): string | null | undefined {
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

  if (normalized.length > 120) {
    throw new BadRequestException('search excede o limite de 120 caracteres');
  }

  return normalized;
}
