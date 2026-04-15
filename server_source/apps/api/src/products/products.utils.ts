import { BadRequestException } from '@nestjs/common';
import { ProductListFilters } from './products.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseListFilters(query: Record<string, string | undefined>): ProductListFilters {
  return {
    search: parseOptionalSearch(query.search),
    categoryId: parseOptionalUuid(query.category_id, 'category_id') ?? undefined,
    isActive: parseOptionalBoolean(query.is_active, 'is_active') ?? undefined,
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

export function parseSku(value: unknown): string {
  return parseRequiredText(value, 'sku', 60).toUpperCase();
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

export function parseOptionalDecimal(
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

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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
