import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialModule } from '../financial/financial.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [DatabaseModule, FinancialModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
