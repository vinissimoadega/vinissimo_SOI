import { BadRequestException } from '@nestjs/common';
import { SupplierListFilters } from './suppliers.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseSupplierListFilters(
  query: Record<string, string | undefined>,
): SupplierListFilters {
  return {
    search: parseOptionalText(query.search, 'search', 120) ?? undefined,
    isActive: parseOptionalBoolean(query.is_active, 'is_active') ?? undefined,
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

export function parseOptionalEmail(
  value: unknown,
  field: string,
): string | null | undefined {
  const normalized = parseOptionalText(value, field, 180);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new BadRequestException(`${field} inválido`);
  }

  return normalized.toLowerCase();
}

export function parseOptionalLeadTimeDays(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(`${field} deve ser um inteiro não negativo`);
    }

    return value;
  }

  if (trimString(value) === '') {
    return null;
  }

  const normalized = Number(trimString(value));

  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new BadRequestException(`${field} deve ser um inteiro não negativo`);
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

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  if (trimString(value) === '') {
    return null;
  }

  const normalized = trimString(value).toLowerCase();

  if (['true', '1', 'ativo'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'inativo'].includes(normalized)) {
    return false;
  }

  throw new BadRequestException(`${field} inválido`);
}

export function parseRequiredUuid(value: unknown, field: string): string {
  const normalized = trimString(value);

  if (!normalized) {
    throw new BadRequestException(`${field} é obrigatório`);
  }

  if (!UUID_PATTERN.test(normalized)) {
    throw new BadRequestException(`${field} inválido`);
  }

  return normalized;
}
