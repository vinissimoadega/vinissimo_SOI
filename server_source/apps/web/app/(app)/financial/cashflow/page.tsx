import Link from "next/link";
import { FinancialTabs } from "@/components/financial/financial-tabs";
import {
  formatCurrency,
  formatDate,
} from "@/components/financial/financial-ui";
import { KpiCard } from "@/components/kpi-card";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getFinancialCashflow } from "@/lib/financial";
import type { FinancialCashflowBucket } from "@/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function single(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function buildQuery(searchParams?: PageProps["searchParams"]) {
  const query = new URLSearchParams();
  const windowDays = single(searchParams?.window_days, "7");
  const channelId = single(searchParams?.channel_id);
  const status = single(searchParams?.status);
  const costNature = single(searchParams?.cost_nature);
  const dateFrom = single(searchParams?.date_from);
  const dateTo = single(searchParams?.date_to);

  query.set("window_days", windowDays || "7");
  if (channelId) query.set("channel_id", channelId);
  if (status) query.set("status", status);
  if (costNature) query.set("cost_nature", costNature);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);

  return {
    query,
    filters: { windowDays, channelId, status, costNature, dateFrom, dateTo },
  };
}

export default async function FinancialCashflowPage({
  searchParams,
}: PageProps) {
  const { query, filters } = buildQuery(searchParams);
  const response = await getFinancialCashflow(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Fluxo de caixa</h1>
          <p className="mt-2 text-sm text-black/55">
            Caixa previsto x realizado por janela operacional, sem confundir venda feita com caixa recebido.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/financial/cashflow">
            Atualizar leitura
          </Link>
        </div>
      </header>

      <FinancialTabs />

      <SectionCard
        title="Filtros"
        subtitle="Ajuste a janela e refine por canal, status e natureza."
      >
        <form className="grid gap-3 md:grid-cols-6" method="get">
          <select
            className="input-soft"
            defaultValue={filters.windowDays}
            name="window_days"
          >
            <option value="1">Hoje</option>
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
          </select>
          <select
            className="input-soft"
            defaultValue={filters.channelId}
            name="channel_id"
          >
            <option value="">Todos os canais</option>
            {response.meta.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.channelName}
              </option>
            ))}
          </select>
          <select
            className="input-soft"
            defaultValue={filters.status}
            name="status"
          >
            <option value="">Todos os status</option>
            <option value="previsto">Previsto</option>
            <option value="vencendo_hoje">Vencendo hoje</option>
            <option value="vencido">Vencido</option>
            <option value="recebido">Recebido</option>
            <option value="recebido_parcial">Recebido parcial</option>
            <option value="pago">Pago</option>
            <option value="pago_parcial">Pago parcial</option>
          </select>
          <select
            className="input-soft"
            defaultValue={filters.costNature}
            name="cost_nature"
          >
            <option value="">Todas as naturezas</option>
            <option value="fixed">Fixa</option>
            <option value="variable">Variável</option>
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
          <div className="flex flex-col gap-2 md:col-span-6 sm:flex-row md:justify-end">
            <button className="btn-primary" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary" href="/financial/cashflow">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Entradas previstas"
          value={formatCurrency(response.summary.entriesExpected)}
          helper={response.summary.windowLabel}
          tone="success"
        />
        <KpiCard
          label="Saídas previstas"
          value={formatCurrency(response.summary.exitsExpected)}
          helper={response.summary.windowLabel}
          tone="warning"
        />
        <KpiCard
          label="Saldo previsto"
          value={formatCurrency(response.summary.predictedBalance)}
          helper="Entradas previstas menos saídas previstas"
        />
        <KpiCard
          label="Entradas realizadas"
          value={formatCurrency(response.summary.entriesRealized)}
          helper={response.summary.windowLabel}
          tone="success"
        />
        <KpiCard
          label="Saídas realizadas"
          value={formatCurrency(response.summary.exitsRealized)}
          helper={response.summary.windowLabel}
          tone="warning"
        />
        <KpiCard
          label="Saldo realizado"
          value={formatCurrency(response.summary.realizedBalance)}
          helper="Entradas realizadas menos saídas realizadas"
        />
      </section>

      <SectionCard
        title="Linha do tempo do caixa"
        subtitle="Resumo diário do previsto x realizado dentro da janela selecionada."
      >
        <SimpleTable<FinancialCashflowBucket>
          columns={[
            {
              key: "referenceDate",
              label: "Data",
              render: (row) => formatDate(row.referenceDate),
            },
            {
              key: "entriesExpected",
              label: "Entradas previstas",
              render: (row) => formatCurrency(row.entriesExpected),
            },
            {
              key: "exitsExpected",
              label: "Saídas previstas",
              render: (row) => formatCurrency(row.exitsExpected),
            },
            {
              key: "predictedBalance",
              label: "Saldo previsto",
              render: (row) => formatCurrency(row.predictedBalance),
            },
            {
              key: "entriesRealized",
              label: "Entradas realizadas",
              render: (row) => formatCurrency(row.entriesRealized),
            },
            {
              key: "exitsRealized",
              label: "Saídas realizadas",
              render: (row) => formatCurrency(row.exitsRealized),
            },
            {
              key: "realizedBalance",
              label: "Saldo realizado",
              render: (row) => formatCurrency(row.realizedBalance),
            },
          ]}
          emptyMessage="Nenhuma movimentação financeira encontrada nesta janela."
          rows={response.buckets}
        />
      </SectionCard>
    </div>
  );
}
