import { BadRequestException } from '@nestjs/common';
import {
  EXPENSE_COST_NATURES,
  EXPENSE_PAYMENT_METHODS,
  ExpenseCostNature,
  ExpenseListFilters,
  ExpensePaymentMethod,
} from './expenses.types';

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseExpenseListFilters(
  query: Record<string, string | undefined>,
): ExpenseListFilters {
  return {
    search: parseOptionalSearch(query.search) ?? undefined,
    category: parseOptionalText(query.category, 'category', 120) ?? undefined,
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

export function parseRequiredMoney(value: unknown, field: string): string {
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

export function parseRequiredDate(value: unknown, field: string): string {
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

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    )
  ) {
    throw new BadRequestException(`${field} inválido`);
  }

  return normalized;
}

export function parseRequiredCostNature(
  value: unknown,
  field: string,
): ExpenseCostNature {
  const normalized = parseRequiredText(value, field, 40).toLowerCase();

  if (!EXPENSE_COST_NATURES.includes(normalized as ExpenseCostNature)) {
    throw new BadRequestException(
      `${field} deve ser um dos valores: ${EXPENSE_COST_NATURES.join(', ')}`,
    );
  }

  return normalized as ExpenseCostNature;
}

export function parseRequiredPaymentMethod(
  value: unknown,
  field: string,
): ExpensePaymentMethod {
  const normalized = parseRequiredText(value, field, 40).toLowerCase();

  if (!EXPENSE_PAYMENT_METHODS.includes(normalized as ExpensePaymentMethod)) {
    throw new BadRequestException(
      `${field} deve ser um dos valores: ${EXPENSE_PAYMENT_METHODS.join(', ')}`,
    );
  }

  return normalized as ExpensePaymentMethod;
}
