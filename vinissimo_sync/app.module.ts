import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { CrmModule } from './crm/crm.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { ExpensesModule } from './expenses/expenses.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    SettingsModule,
    AuthModule,
    DashboardModule,
    CrmModule,
    ExpensesModule,
    ProductsModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    SalesModule,
    InventoryModule,
  ],
})
export class AppModule {}
