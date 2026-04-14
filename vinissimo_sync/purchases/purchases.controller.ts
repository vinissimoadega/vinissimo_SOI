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
import { PurchasesService } from './purchases.service';
import { parsePurchaseListFilters } from './purchases.utils';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.purchasesService.listPurchases(parsePurchaseListFilters(query));
  }

  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.purchasesService.createPurchase(body, currentUser);
  }

  @Get(':purchaseId')
  async getById(
    @Param('purchaseId', new ParseUUIDPipe({ version: '4' })) purchaseId: string,
  ) {
    return this.purchasesService.getPurchaseById(purchaseId);
  }

  @Patch(':purchaseId')
  async update(
    @Param('purchaseId', new ParseUUIDPipe({ version: '4' })) purchaseId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.purchasesService.updatePurchase(purchaseId, body);
  }
}
