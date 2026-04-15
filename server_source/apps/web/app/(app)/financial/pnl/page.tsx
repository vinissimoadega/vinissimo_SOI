import Link from "next/link";
import { FinancialTabs } from "@/components/financial/financial-tabs";
import {
  formatCurrency,
  formatPct,
} from "@/components/financial/financial-ui";
import { KpiCard } from "@/components/kpi-card";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getFinancialPnl } from "@/lib/financial";
import type { FinancialPnlChannelSummary } from "@/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function single(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function buildQuery(searchParams?: PageProps["searchParams"]) {
  const query = new URLSearchParams();
  const channelId = single(searchParams?.channel_id);
  const dateFrom = single(searchParams?.date_from);
  const dateTo = single(searchParams?.date_to);

  if (channelId) query.set("channel_id", channelId);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);

  return {
    query,
    filters: { channelId, dateFrom, dateTo },
  };
}

export default async function FinancialPnlPage({ searchParams }: PageProps) {
  const { query, filters } = buildQuery(searchParams);
  const response = await getFinancialPnl(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>DRE gerencial simplificada</h1>
          <p className="mt-2 text-sm text-black/55">
            Receita, custos, despesas e resultado operacional em leitura gerencial clara.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/financial/pnl">
            Atualizar leitura
          </Link>
        </div>
      </header>

      <FinancialTabs />

      <SectionCard
        title="Filtros"
        subtitle="Consolide o período ou aprofunde por canal."
      >
        <form className="grid gap-3 md:grid-cols-4" method="get">
          <select
            className="input-soft"
            defaultValue={filters.channelId}
            name="channel_id"
          >
            <option value="">Consolidado</option>
            {response.meta.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.channelName}
              </option>
            ))}
          </select>
          <input
            className="input-soft"
            defaultValue={filters.dateFrom}
            name="date_from"
            type="date"
          />
          <input
            className="input-soft"
            defaultValue={filters.dateTo}
            name="date_to"
            type="date"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-primary flex-1" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary flex-1" href="/financial/pnl">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receita bruta"
          value={formatCurrency(response.summary.grossRevenue)}
          tone="success"
        />
        <KpiCard
          label="Receita líquida"
          value={formatCurrency(response.summary.netRevenue)}
          tone="success"
        />
        <KpiCard
          label="Lucro bruto"
          value={formatCurrency(response.summary.grossProfit)}
        />
        <KpiCard
          label="Resultado operacional"
          value={formatCurrency(response.summary.operatingResult)}
          helper={`Margem ${formatPct(response.summary.operatingMarginPct)}`}
        />
      </section>

      <SectionCard
        title="Resumo gerencial"
        subtitle="Custos adicionais por venda e despesas operacionais já entram nesta leitura."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm text-black/65">
            <p>Receita bruta: {formatCurrency(response.summary.grossRevenue)}</p>
            <p>Descontos e taxas: {formatCurrency(response.summary.discountsAndFees)}</p>
            <p>Receita líquida: {formatCurrency(response.summary.netRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm text-black/65">
            <p>CPV: {formatCurrency(response.summary.cogs)}</p>
            <p>Custos adicionais por venda: {formatCurrency(response.summary.additionalSaleCosts)}</p>
            <p>Lucro bruto: {formatCurrency(response.summary.grossProfit)}</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm text-black/65">
            <p>Despesas operacionais: {formatCurrency(response.summary.operatingExpenses)}</p>
            <p>Resultado operacional: {formatCurrency(response.summary.operatingResult)}</p>
            <p>Margem operacional: {formatPct(response.summary.operatingMarginPct)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Comparativo por canal"
        subtitle="Ajuda a separar performance de venda da conversão efetiva em caixa."
      >
        <SimpleTable<FinancialPnlChannelSummary>
          columns={[
            { key: "channelName", label: "Canal" },
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
              key: "operatingResult",
              label: "Resultado operacional",
              render: (row) => formatCurrency(row.operatingResult),
            },
            {
              key: "operatingMarginPct",
              label: "Margem",
              render: (row) => formatPct(row.operatingMarginPct),
            },
          ]}
          emptyMessage="Ainda não há canais suficientes para compor a DRE comparativa."
          rows={response.channels}
        />
      </SectionCard>
    </div>
  );
}
