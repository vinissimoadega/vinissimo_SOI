import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { SupplierListFilters, SupplierRecord } from './suppliers.types';
import {
  parseOptionalBoolean,
  parseOptionalEmail,
  parseOptionalLeadTimeDays,
  parseOptionalText,
  parseRequiredText,
} from './suppliers.utils';

type SupplierRow = QueryResultRow & SupplierRecord;

type SupplierCreatePayload = {
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
};

type SupplierPatchPayload = {
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
  isActive?: boolean;
};

@Injectable()
export class SuppliersService {
  constructor(private readonly db: DatabaseService) {}

  async listSuppliers(filters: SupplierListFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      params.push(`%${filters.search}%`);
      where.push(
        `(
          s.name ILIKE $${params.length}
          OR COALESCE(s.contact_name, '') ILIKE $${params.length}
          OR COALESCE(s.phone, '') ILIKE $${params.length}
          OR COALESCE(s.email, '') ILIKE $${params.length}
          OR COALESCE(s.supplier_code, '') ILIKE $${params.length}
        )`,
      );
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      where.push(`s.is_active = $${params.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await this.db.query<SupplierRow>(
      `SELECT
         s.id,
         s.supplier_code AS "supplierCode",
         s.name,
         s.contact_name AS "contactName",
         s.phone,
         s.email,
         s.lead_time_days AS "leadTimeDays",
         s.notes,
         s.is_active AS "isActive",
         s.created_at AS "createdAt",
         s.updated_at AS "updatedAt"
       FROM soi.suppliers AS s
       ${whereClause}
       ORDER BY s.is_active DESC, s.name ASC, s.created_at DESC;`,
      params,
    );

    return {
      items: result.rows,
      filters: {
        search: filters.search ?? null,
        isActive: filters.isActive ?? null,
      },
    };
  }

  async createSupplier(body: Record<string, unknown>) {
    const payload = this.parseCreatePayload(body);
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO soi.suppliers (
         name,
         contact_name,
         phone,
         email,
         lead_time_days,
         notes,
         is_active,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id;`,
      [
        payload.name,
        payload.contactName,
        payload.phone,
        payload.email,
        payload.leadTimeDays,
        payload.notes,
        payload.isActive,
      ],
    );

    return this.getSupplierById(result.rows[0].id);
  }

  async updateSupplier(supplierId: string, body: Record<string, unknown>) {
    const payload = this.parsePatchPayload(body);

    if (Object.keys(payload).length === 0) {
      return this.getSupplierById(supplierId);
    }

    const assignments: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (payload.name !== undefined) {
      params.push(payload.name);
      assignments.push(`name = $${params.length}`);
    }

    if (payload.contactName !== undefined) {
      params.push(payload.contactName);
      assignments.push(`contact_name = $${params.length}`);
    }

    if (payload.phone !== undefined) {
      params.push(payload.phone);
      assignments.push(`phone = $${params.length}`);
    }

    if (payload.email !== undefined) {
      params.push(payload.email);
      assignments.push(`email = $${params.length}`);
    }

    if (payload.leadTimeDays !== undefined) {
      params.push(payload.leadTimeDays);
      assignments.push(`lead_time_days = $${params.length}`);
    }

    if (payload.notes !== undefined) {
      params.push(payload.notes);
      assignments.push(`notes = $${params.length}`);
    }

    if (payload.isActive !== undefined) {
      params.push(payload.isActive);
      assignments.push(`is_active = $${params.length}`);
    }

    params.push(supplierId);

    const updateResult = await this.db.query<{ id: string }>(
      `UPDATE soi.suppliers
       SET ${assignments.join(', ')}
       WHERE id = $${params.length}
       RETURNING id;`,
      params,
    );

    if (!updateResult.rows[0]) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return this.getSupplierById(supplierId);
  }

  async getSupplierById(supplierId: string) {
    const result = await this.db.query<SupplierRow>(
      `SELECT
         s.id,
         s.supplier_code AS "supplierCode",
         s.name,
         s.contact_name AS "contactName",
         s.phone,
         s.email,
         s.lead_time_days AS "leadTimeDays",
         s.notes,
         s.is_active AS "isActive",
         s.created_at AS "createdAt",
         s.updated_at AS "updatedAt"
       FROM soi.suppliers AS s
       WHERE s.id = $1
       LIMIT 1;`,
      [supplierId],
    );

    const supplier = result.rows[0];

    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado');
    }

    return supplier;
  }

  private parseCreatePayload(body: Record<string, unknown>): SupplierCreatePayload {
    return {
      name: parseRequiredText(body.name, 'name', 180),
      contactName: parseOptionalText(body.contactName, 'contactName', 120) ?? null,
      phone: parseOptionalText(body.phone, 'phone', 40) ?? null,
      email: parseOptionalEmail(body.email, 'email') ?? null,
      leadTimeDays:
        parseOptionalLeadTimeDays(body.leadTimeDays, 'leadTimeDays') ?? null,
      notes: parseOptionalText(body.notes, 'notes', 1200) ?? null,
      isActive: parseOptionalBoolean(body.isActive, 'isActive') ?? true,
    };
  }

  private parsePatchPayload(body: Record<string, unknown>): SupplierPatchPayload {
    const payload: SupplierPatchPayload = {};

    const name = parseOptionalText(body.name, 'name', 180);
    if (name !== undefined) {
      if (name === null) {
        throw new BadRequestException('name é obrigatório');
      }
      payload.name = name;
    }

    const contactName = parseOptionalText(body.contactName, 'contactName', 120);
    if (contactName !== undefined) {
      payload.contactName = contactName;
    }

    const phone = parseOptionalText(body.phone, 'phone', 40);
    if (phone !== undefined) {
      payload.phone = phone;
    }

    const email = parseOptionalEmail(body.email, 'email');
    if (email !== undefined) {
      payload.email = email;
    }

    const leadTimeDays = parseOptionalLeadTimeDays(
      body.leadTimeDays,
      'leadTimeDays',
    );
    if (leadTimeDays !== undefined) {
      payload.leadTimeDays = leadTimeDays;
    }

    const notes = parseOptionalText(body.notes, 'notes', 1200);
    if (notes !== undefined) {
      payload.notes = notes;
    }

    const isActive = parseOptionalBoolean(body.isActive, 'isActive');
    if (isActive !== undefined && isActive !== null) {
      payload.isActive = isActive;
    }

    return payload;
  }
}
