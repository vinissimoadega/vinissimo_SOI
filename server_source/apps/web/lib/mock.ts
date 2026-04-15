import type {
  AlertItem,
  ChannelPerformance,
  CustomerAttentionItem,
  KpiCardData,
  StockCriticalItem,
} from "@/types";

export const fallbackKpis: KpiCardData[] = [
  { label: "Receita líquida", value: "R$ 0,00", helper: "Aguardando integração" },
  { label: "Lucro bruto", value: "R$ 0,00", helper: "Aguardando integração" },
  { label: "Clientes recorrentes", value: "0", helper: "Base ainda não conectada" },
  { label: "Capital em estoque", value: "R$ 0,00", helper: "Aguardando snapshot" },
  { label: "Rupturas", value: "0", tone: "warning", helper: "Sem leitura de estoque" },
  { label: "Repor agora", value: "0", tone: "warning", helper: "Sem leitura de estoque" },
  { label: "Clientes inativos", value: "0", tone: "danger", helper: "Sem CRM real" },
  { label: "Ticket médio", value: "R$ 0,00", helper: "Sem vendas entregues" }
];

export const fallbackAlerts: AlertItem[] = [
  {
    id: "alert-1",
    severity: "medium",
    title: "Backend integrado parcialmente",
    message: "Healthcheck e settings já respondem. Módulos analíticos ainda estão em bootstrap.",
    entity: "SOI",
    href: "/settings"
  },
  {
    id: "alert-2",
    severity: "low",
    title: "Dashboard em modo inicial",
    message: "KPIs operacionais ainda não estão ligados aos endpoints finais de compras, vendas e estoque.",
    entity: "Dashboard",
    href: "/dashboard"
  }
];

export const fallbackChannelPerformance: ChannelPerformance[] = [
  { channel: "WhatsApp", pedidos: 0, receita: "R$ 0,00", lucro: "R$ 0,00", ticket: "R$ 0,00", margem: "—" },
  { channel: "Instagram", pedidos: 0, receita: "R$ 0,00", lucro: "R$ 0,00", ticket: "R$ 0,00", margem: "—" },
  { channel: "iFood", pedidos: 0, receita: "R$ 0,00", lucro: "R$ 0,00", ticket: "R$ 0,00", margem: "—" },
  { channel: "Balcão", pedidos: 0, receita: "R$ 0,00", lucro: "R$ 0,00", ticket: "R$ 0,00", margem: "—" }
];

export const fallbackStockCritical: StockCriticalItem[] = [
  { sku: "VIN001", produto: "Exemplo de SKU", estoque: "—", minimo: "—", cobertura: "—", status: "atencao" },
  { sku: "VIN002", produto: "Espumante de referência", estoque: "—", minimo: "—", cobertura: "—", status: "ok" }
];

export const fallbackCustomerAttention: CustomerAttentionItem[] = [
  { nome: "Base ainda não conectada", status: "lead", ultimaCompra: "—", ticket: "—" },
  { nome: "Sem leitura de recorrência", status: "inativo", ultimaCompra: "—", ticket: "—" }
];
