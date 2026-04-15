import Link from "next/link";
import { AlertsList } from "@/components/alerts-list";
import { KpiCard } from "@/components/kpi-card";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardOverview } from "@/lib/dashboard";
import type {
  DashboardChannelSummary,
  DashboardCriticalStockItem,
  DashboardPendingBaseItem,
  InventoryStockStatus,
} from "@/types";

export const dynamic = "force-dynamic";

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatMargin(value: string | null) {
  if (value === null) {
    return "—";
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDecimal(value: string | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function getStockStatusLabel(status: InventoryStockStatus) {
  switch (status) {
    case "ruptura":
      return "Ruptura";
    case "repor_agora":
      return "Repor agora";
    case "atencao":
      return "Atenção";
    default:
      return "OK";
  }
}

export default async function DashboardPage() {
  const data = await getDashboardOverview();
  const quickLinks = [
    { href: "/sales", label: "Operar vendas", helper: "Pedidos, receita e margem" },
    { href: "/inventory", label: "Operar estoque", helper: "Semáforos, cobertura e capital" },
    { href: "/purchases", label: "Operar compras", helper: "Reposição e custo operacional" },
    { href: "/customers", label: "Operar clientes", helper: "Leads e recorrência" },
  ];

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="mt-2 text-sm text-black/55">
            Leitura operacional e executiva da base real reconciliada da Viníssimo,
            com pendências explícitas e sem misturar itens fora da base atual.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/inventory">
            Ver estoque
          </Link>
          <Link className="btn-primary" href="/sales">
            Ver vendas
          </Link>
        </div>
      </header>

      <SectionCard
        title="Resumo executivo"
        subtitle={`Base reconciliada com ${data.baseCoverage.realProducts} produtos reais e ${data.pendingBase.totalItems} pendência(s) fora da leitura principal.`}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            helper={`${data.executiveSummary.deliveredOrdersCount} pedido(s) entregues`}
            label="Receita bruta"
            tone="default"
            value={formatCurrency(data.executiveSummary.grossRevenue)}
          />
          <KpiCard
            label="Receita líquida"
            tone="default"
            value={formatCurrency(data.executiveSummary.netRevenue)}
          />
          <KpiCard
            label="Lucro bruto"
            tone={Number(data.executiveSummary.grossProfit) > 0 ? "success" : "warning"}
            value={formatCurrency(data.executiveSummary.grossProfit)}
          />
          <KpiCard
            helper="Lucro bruto / receita líquida"
            label="Margem bruta média"
            tone="default"
            value={formatMargin(data.executiveSummary.grossMarginPct)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Estoque"
        subtitle="Capital empatado e semáforos operacionais derivados exclusivamente dos movimentos."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            helper="Soma do estoque atual pelo custo operacional vigente"
            label="Valor total em estoque"
            tone="default"
            value={formatCurrency(data.stockSummary.totalStockValue)}
          />
          <KpiCard
            label="Ruptura"
            tone={data.stockSummary.rupturaCount > 0 ? "danger" : "default"}
            value={String(data.stockSummary.rupturaCount)}
          />
          <KpiCard
            label="Repor agora"
            tone={data.stockSummary.reporAgoraCount > 0 ? "warning" : "default"}
            value={String(data.stockSummary.reporAgoraCount)}
          />
          <KpiCard
            label="Atenção"
            tone={data.stockSummary.atencaoCount > 0 ? "warning" : "default"}
            value={String(data.stockSummary.atencaoCount)}
          />
          <KpiCard label="OK" tone="success" value={String(data.stockSummary.okCount)} />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Alertas operacionais"
          subtitle="Leitura de exceções para ruptura, reposição e pendências da base reconciliada."
        >
          <AlertsList items={data.alerts} />
        </SectionCard>

        <SectionCard
          title="Ações rápidas"
          subtitle="Atalhos operacionais sem puxar leituras fora do escopo atual."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                className="surface flex flex-col gap-1 p-4 transition hover:border-vinho-900/20 hover:bg-vinho-50"
                href={item.href}
              >
                <span className="text-sm font-semibold text-grafite">{item.label}</span>
                <span className="text-xs text-black/45">{item.helper}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Canais"
        subtitle="Vendas entregues, receita e margem por origem comercial."
      >
        <SimpleTable<DashboardChannelSummary>
          columns={[
            { key: "channelName", label: "Canal" },
            { key: "ordersCount", label: "Vendas" },
            {
              key: "grossRevenue",
              label: "Receita bruta",
              render: (row) => formatCurrency(row.grossRevenue),
            },
            {
              key: "netRevenue",
              label: "Receita líquida",
              render: (row) => formatCurrency(row.netRevenue),
            },
            {
              key: "grossProfit",
              label: "Lucro bruto",
              render: (row) => formatCurrency(row.grossProfit),
            },
            {
              key: "grossMarginPct",
              label: "Margem",
              render: (row) => formatMargin(row.grossMarginPct),
            },
          ]}
          rows={data.channelSummary}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Produtos em atenção"
          subtitle="Itens em ruptura, abaixo do mínimo usado ou já entrando na faixa de atenção."
        >
          <SimpleTable<DashboardCriticalStockItem>
            columns={[
              { key: "sku", label: "SKU" },
              { key: "name", label: "Produto" },
              {
                key: "currentStockQty",
                label: "Estoque",
                render: (row) => formatDecimal(row.currentStockQty),
              },
              {
                key: "usedMinStockQty",
                label: "Mínimo usado",
                render: (row) => formatDecimal(row.usedMinStockQty),
              },
              {
                key: "coverageDays",
                label: "Cobertura",
                render: (row) =>
                  row.coverageDays ? `${formatDecimal(row.coverageDays)} dias` : "Sem giro",
              },
              {
                key: "stockStatus",
                label: "Status",
                render: (row) => (
                  <StatusBadge
                    label={getStockStatusLabel(row.stockStatus)}
                    tone={row.stockStatus}
                  />
                ),
              },
            ]}
            rows={data.criticalStock}
            emptyMessage="Nenhum item fora do status OK nesta leitura."
          />
        </SectionCard>

        <SectionCard
          title="Clientes"
          subtitle={`Distribuição atual dos ${data.customerSummary.totalActiveCustomers} clientes ativos por estágio operacional.`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard label="Lead" tone="default" value={String(data.customerSummary.leadCount)} />
            <KpiCard label="Novo" tone="default" value={String(data.customerSummary.novoCount)} />
            <KpiCard
              label="Recorrente"
              tone="success"
              value={String(data.customerSummary.recorrenteCount)}
            />
            <KpiCard
              label="Inativo"
              tone={data.customerSummary.inativoCount > 0 ? "warning" : "default"}
              value={String(data.customerSummary.inativoCount)}
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Pendências da base"
        subtitle="Itens fora da base reconciliada atual, explicitamente excluídos das leituras consolidadas."
      >
        <div className="mb-4 grid gap-4 md:grid-cols-3" id="pendencias-base">
          <KpiCard
            helper="Produtos reais reconciliados"
            label="Produtos na base"
            tone="default"
            value={String(data.baseCoverage.realProducts)}
          />
          <KpiCard
            helper="Cobertura de custo atual"
            label="Produtos com custo"
            tone={data.baseCoverage.productsWithoutCost === 0 ? "success" : "warning"}
            value={String(data.baseCoverage.productsWithCost)}
          />
          <KpiCard
            helper="Fora da base reconciliada"
            label="Pendências explícitas"
            tone={data.pendingBase.totalItems > 0 ? "warning" : "success"}
            value={String(data.pendingBase.totalItems)}
          />
        </div>

        <p className="mb-4 text-sm text-black/55">{data.pendingBase.note}</p>

        <SimpleTable<DashboardPendingBaseItem>
          columns={[
            {
              key: "sku",
              label: "SKU",
              render: (row) => row.sku ?? "Sem SKU",
            },
            { key: "name", label: "Item" },
            { key: "reason", label: "Motivo" },
            { key: "source", label: "Origem" },
          ]}
          rows={data.pendingBase.items}
        />
      </SectionCard>
    </div>
  );
}
