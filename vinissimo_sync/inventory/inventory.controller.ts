import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
import {
  parseInventoryMovementFilters,
  parseInventoryStatusFilters,
} from './inventory.utils';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('status')
  async listStatus(@Query() query: Record<string, string | undefined>) {
    return this.inventoryService.listInventoryStatus(
      parseInventoryStatusFilters(query),
    );
  }

  @Get('movements')
  async listMovements(@Query() query: Record<string, string | undefined>) {
    return this.inventoryService.listInventoryMovements(
      parseInventoryMovementFilters(query),
    );
  }

  @Post('movements')
  async createManualAdjustment(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.inventoryService.createManualAdjustment(body, currentUser);
  }

  @Get('products/:productId/min-prices')
  async getMinPrices(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ) {
    return this.inventoryService.getProductMinPrices(productId);
  }
}
