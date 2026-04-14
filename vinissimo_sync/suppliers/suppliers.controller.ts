import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { parseRequiredUuid, parseSupplierListFilters } from './suppliers.utils';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.suppliersService.listSuppliers(parseSupplierListFilters(query));
  }

  @Get(':supplierId')
  async getById(
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
  ) {
    return this.suppliersService.getSupplierById(
      parseRequiredUuid(supplierId, 'supplierId'),
    );
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.suppliersService.createSupplier(body);
  }

  @Patch(':supplierId')
  async update(
    @Param('supplierId', new ParseUUIDPipe({ version: '4' })) supplierId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.suppliersService.updateSupplier(
      parseRequiredUuid(supplierId, 'supplierId'),
      body,
    );
  }
}
