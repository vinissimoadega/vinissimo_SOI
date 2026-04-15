import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list() {
    return this.productsService.listCategories();
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.productsService.createCategory(body);
  }
}
