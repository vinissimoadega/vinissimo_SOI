import { DashboardPendingBaseItem } from './dashboard.types';

export const DASHBOARD_PENDING_BASE_ITEMS: DashboardPendingBaseItem[] = [
  {
    sku: '7808725410158',
    name: 'Chilano Dark Blend',
    reason: 'SKU nao encontrado no cadastro atual',
    source: 'Planilha de estoque real',
  },
  {
    sku: '7808725400340',
    name: 'Chilano Syrah',
    reason: 'SKU nao encontrado no cadastro atual',
    source: 'Planilha de estoque real',
  },
  {
    sku: null,
    name: 'Mataojo Merlot',
    reason: 'Item sem SKU na planilha atual',
    source: 'Planilha de estoque real',
  },
];
