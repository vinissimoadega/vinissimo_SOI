import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialModule } from '../financial/financial.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [DatabaseModule, FinancialModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
