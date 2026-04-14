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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SalesService } from './sales.service';
import { parseSaleListFilters } from './sales.utils';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.salesService.listSales(parseSaleListFilters(query));
  }

  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.salesService.createSale(body, currentUser);
  }

  @Get(':saleId')
  async getById(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
  ) {
    return this.salesService.getSaleById(saleId);
  }

  @Patch(':saleId')
  async update(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.salesService.updateSale(saleId, body, currentUser);
  }
}
