import Link from "next/link";
import { FinancialTabs } from "@/components/financial/financial-tabs";
import {
  FinancialPayableStatusBadge,
  FinancialReceivableStatusBadge,
  FinancialSettlementStatusBadge,
  formatCurrency,
  formatPct,
} from "@/components/financial/financial-ui";
import { KpiCard } from "@/components/kpi-card";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getFinancialOverview } from "@/lib/financial";
import type {
  FinancialAlert,
  FinancialPayableItem,
  FinancialReceivableItem,
  FinancialSettlementBatch,
} from "@/types";

export const dynamic = "force-dynamic";

function formatValue(label: string, value: string) {
  if (label.toLowerCase().includes("margem")) {
    return formatPct(value);
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  return formatCurrency(value);
}

export default async function FinancialOverviewPage() {
  const overview = await getFinancialOverview();

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Financeiro gerencial</h1>
          <p className="mt-2 text-sm text-black/55">
            Leitura executiva do caixa previsto x realizado, DRE simplificada,
            repasse iFood e títulos financeiros gerados a partir da operação.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/financial/overview">
            Atualizar leitura
          </Link>
        </div>
      </header>

      <FinancialTabs />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={overview.cards.receivableToday.label}
          value={formatValue(
            overview.cards.receivableToday.label,
            overview.cards.receivableToday.value,
          )}
          helper={overview.cards.receivableToday.helper ?? undefined}
          tone="success"
        />
        <KpiCard
          label={overview.cards.payableToday.label}
          value={formatValue(
            overview.cards.payableToday.label,
            overview.cards.payableToday.value,
          )}
          helper={overview.cards.payableToday.helper ?? undefined}
          tone="warning"
        />
        <KpiCard
          label={overview.cards.predictedBalance7Days.label}
          value={formatValue(
            overview.cards.predictedBalance7Days.label,
            overview.cards.predictedBalance7Days.value,
          )}
          helper={overview.cards.predictedBalance7Days.helper ?? undefined}
          tone="default"
        />
        <KpiCard
          label={overview.cards.predictedBalance30Days.label}
          value={formatValue(
            overview.cards.predictedBalance30Days.label,
            overview.cards.predictedBalance30Days.value,
          )}
          helper={overview.cards.predictedBalance30Days.helper ?? undefined}
          tone="default"
        />
        <KpiCard
          label={overview.cards.ifoodSettlement.label}
          value={formatValue(
            overview.cards.ifoodSettlement.label,
            overview.cards.ifoodSettlement.value,
          )}
          helper={overview.cards.ifoodSettlement.helper ?? undefined}
          tone="warning"
        />
        <KpiCard
          label={overview.cards.overdueExpenses.label}
          value={formatValue(
            overview.cards.overdueExpenses.label,
            overview.cards.overdueExpenses.value,
          )}
          helper={overview.cards.overdueExpenses.helper ?? undefined}
          tone="danger"
        />
        <KpiCard
          label={overview.cards.managementMargin.label}
          value={formatValue(
            overview.cards.managementMargin.label,
            overview.cards.managementMargin.value,
          )}
          helper={overview.cards.managementMargin.helper ?? undefined}
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Contas a receber em atenção"
          subtitle="Recebíveis vencidos, vencendo hoje ou parcialmente recebidos."
          action={
            <Link className="btn-secondary" href="/financial/receivables">
              Abrir contas a receber
            </Link>
          }
        >
          <SimpleTable<FinancialReceivableItem>
            columns={[
              { key: "receivableNumber", label: "Título" },
              {
                key: "counterpartyName",
                label: "Contraparte",
                render: (row) => row.counterpartyName ?? row.channelName ?? "—",
              },
              {
                key: "netExpectedAmount",
                label: "Valor líquido",
                render: (row) => formatCurrency(row.netExpectedAmount),
              },
              {
                key: "expectedReceiptDate",
                label: "Previsto",
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <FinancialReceivableStatusBadge status={row.status} />
                ),
              },
            ]}
            emptyMessage="Nenhuma conta a receber em atenção agora."
            rows={overview.receivablesDue}
          />
        </SectionCard>

        <SectionCard
          title="Contas a pagar em atenção"
          subtitle="Pagamentos vencidos, vencendo hoje ou pagos parcialmente."
          action={
            <Link className="btn-secondary" href="/financial/payables">
              Abrir contas a pagar
            </Link>
          }
        >
          <SimpleTable<FinancialPayableItem>
            columns={[
              { key: "payableNumber", label: "Título" },
              {
                key: "counterpartyName",
                label: "Contraparte",
                render: (row) => row.supplierName ?? row.counterpartyName ?? "—",
              },
              {
                key: "amount",
                label: "Valor",
                render: (row) => formatCurrency(row.amount),
              },
              { key: "dueDate", label: "Vencimento" },
              {
                key: "status",
                label: "Status",
                render: (row) => <FinancialPayableStatusBadge status={row.status} />,
              },
            ]}
            emptyMessage="Nenhuma conta a pagar em atenção agora."
            rows={overview.payablesDue}
          />
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Fluxo de caixa resumido"
          subtitle="Comparativo entre caixa previsto e realizado nas janelas prioritárias."
          action={
            <Link className="btn-secondary" href="/financial/cashflow">
              Abrir fluxo de caixa
            </Link>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4">
              <p className="text-xs uppercase tracking-wide text-black/45">
                Próximos 7 dias
              </p>
              <div className="mt-3 space-y-2 text-sm text-black/65">
                <p>Entradas previstas: {formatCurrency(overview.cashflowSummary7Days.entriesExpected)}</p>
                <p>Saídas previstas: {formatCurrency(overview.cashflowSummary7Days.exitsExpected)}</p>
                <p>Saldo previsto: {formatCurrency(overview.cashflowSummary7Days.predictedBalance)}</p>
                <p>Saldo realizado: {formatCurrency(overview.cashflowSummary7Days.realizedBalance)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4">
              <p className="text-xs uppercase tracking-wide text-black/45">
                Próximos 30 dias
              </p>
              <div className="mt-3 space-y-2 text-sm text-black/65">
                <p>Entradas previstas: {formatCurrency(overview.cashflowSummary30Days.entriesExpected)}</p>
                <p>Saídas previstas: {formatCurrency(overview.cashflowSummary30Days.exitsExpected)}</p>
                <p>Saldo previsto: {formatCurrency(overview.cashflowSummary30Days.predictedBalance)}</p>
                <p>Saldo realizado: {formatCurrency(overview.cashflowSummary30Days.realizedBalance)}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="DRE gerencial resumida"
          subtitle="Leitura simplificada para decisão operacional, sem viés fiscal."
          action={
            <Link className="btn-secondary" href="/financial/pnl">
              Abrir DRE simplificada
            </Link>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm text-black/65">
              <p>Receita bruta: {formatCurrency(overview.pnlSummary.grossRevenue)}</p>
              <p>Descontos e taxas: {formatCurrency(overview.pnlSummary.discountsAndFees)}</p>
              <p>Receita líquida: {formatCurrency(overview.pnlSummary.netRevenue)}</p>
              <p>CPV: {formatCurrency(overview.pnlSummary.cogs)}</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm text-black/65">
              <p>Custos adicionais por venda: {formatCurrency(overview.pnlSummary.additionalSaleCosts)}</p>
              <p>Lucro bruto: {formatCurrency(overview.pnlSummary.grossProfit)}</p>
              <p>Despesas operacionais: {formatCurrency(overview.pnlSummary.operatingExpenses)}</p>
              <p>Resultado operacional: {formatCurrency(overview.pnlSummary.operatingResult)}</p>
              <p>Margem operacional: {formatPct(overview.pnlSummary.operatingMarginPct)}</p>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Alertas financeiros"
          subtitle="Sinais que merecem ação operacional antes de virar ruído de caixa."
        >
          <div className="space-y-3">
            {overview.alerts.length === 0 ? (
              <p className="text-sm text-black/55">
                Nenhum alerta financeiro relevante neste momento.
              </p>
            ) : (
              overview.alerts.map((alert: FinancialAlert) => (
                <article
                  key={alert.id}
                  className="rounded-2xl border border-black/5 bg-black/[0.02] p-4"
                >
                  <p className="font-medium text-grafite">{alert.title}</p>
                  <p className="mt-1 text-sm text-black/55">{alert.description}</p>
                </article>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Repasses e regras por canal"
          subtitle="iFood e demais canais com leitura financeira própria."
          action={
            <Link className="btn-secondary" href="/financial/settlements">
              Abrir repasses
            </Link>
          }
        >
          <SimpleTable<FinancialSettlementBatch>
            columns={[
              { key: "batchReference", label: "Lote" },
              { key: "channelName", label: "Canal" },
              {
                key: "expectedAmount",
                label: "Esperado",
                render: (row) => formatCurrency(row.expectedAmount),
              },
              { key: "expectedReceiptDate", label: "Data prevista" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <FinancialSettlementStatusBadge status={row.status} />
                ),
              },
            ]}
            emptyMessage="Nenhum lote de repasse criado até agora."
            rows={overview.settlementBatches}
          />
        </SectionCard>
      </section>
    </div>
  );
}
