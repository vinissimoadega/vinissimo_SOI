import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { parseListFilters } from './products.utils';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.productsService.listProducts(parseListFilters(query));
  }

  @Get('lookup/by-sku')
  async lookupBySku(@Query('sku') sku: string | undefined) {
    return this.productsService.lookupProductBySku(sku);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.productsService.createProduct(body);
  }

  @Get(':productId/channel-prices')
  async getChannelPrices(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ) {
    return this.productsService.getProductChannelPrices(productId);
  }

  @Put(':productId/channel-prices')
  async replaceChannelPrices(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.productsService.replaceProductChannelPrices(productId, body);
  }

  @Get(':productId')
  async getById(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ) {
    return this.productsService.getProductById(productId);
  }

  @Patch(':productId')
  async update(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.productsService.updateProduct(productId, body);
  }
}
