import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialModule } from '../financial/financial.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [DatabaseModule, FinancialModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
