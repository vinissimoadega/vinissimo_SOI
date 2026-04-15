import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async list(@Query() query: Record<string, string | undefined>) {
    return this.expensesService.listExpenses(this.expensesService.parseFilters(query));
  }

  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.expensesService.createExpense(body, currentUser);
  }
}
