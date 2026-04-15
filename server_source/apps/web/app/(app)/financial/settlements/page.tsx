import Link from "next/link";
import { GenerateIfoodBatchesAction, SettlementBatchActions, ChannelRuleActions } from "@/components/financial/financial-actions";
import { FinancialTabs } from "@/components/financial/financial-tabs";
import {
  FinancialSettlementStatusBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPct,
  formatSettlementStatus,
  formatSettlementRule,
  formatSettlementType,
} from "@/components/financial/financial-ui";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getFinancialSettlements } from "@/lib/financial";
import type { FinancialChannelRule, FinancialSettlementBatch } from "@/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function single(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function buildQuery(searchParams?: PageProps["searchParams"]) {
  const query = new URLSearchParams();
  const status = single(searchParams?.status);
  const page = single(searchParams?.page, "1");
  const pageSize = single(searchParams?.page_size, "12");

  if (status) query.set("status", status);
  query.set("page", page);
  query.set("page_size", pageSize);

  return {
    query,
    filters: { status, page, pageSize },
  };
}

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize);
  return `/financial/settlements?${query.toString()}`;
}

export default async function FinancialSettlementsPage({
  searchParams,
}: PageProps) {
  const { query, filters } = buildQuery(searchParams);
  const response = await getFinancialSettlements(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Repasses e regras por canal</h1>
          <p className="mt-2 text-sm text-black/55">
            Regra financeira configurável por canal e lotes de repasse do iFood com quarta-feira como padrão operacional.
          </p>
        </div>
      </header>

      <FinancialTabs />

      <SectionCard
        title="Gerar lotes iFood"
        subtitle="Agrupa recebíveis iFood ainda em aberto por competência e data prevista."
        action={<GenerateIfoodBatchesAction />}
      >
        <p className="text-sm text-black/55">
          Regra padrão: próxima quarta-feira após a venda. Se houver divergência real do marketplace, a data prevista do lote pode ser ajustada manualmente.
        </p>
      </SectionCard>

      <SectionCard
        title="Regras financeiras por canal"
        subtitle="Define quando a venda vira caixa previsto e qual taxa gerencial entra na leitura."
      >
        <SimpleTable<FinancialChannelRule>
          columns={[
            {
              key: "channelName",
              label: "Canal",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-grafite">{row.channelName}</p>
                  <p className="text-xs text-black/45">{row.channelKey}</p>
                </div>
              ),
            },
            {
              key: "settlementType",
              label: "Regra atual",
              render: (row) => (
                <div className="space-y-1 text-sm">
                  <p>Liquidação: {formatSettlementType(row.settlementType)}</p>
                  <p>Vencimento: {formatSettlementRule(row.expectedSettlementRule)}</p>
                  <p>Taxa: {row.feePct ? formatPct(row.feePct) : "—"}</p>
                </div>
              ),
            },
            {
              key: "actions",
              label: "Ajustar",
              render: (row) => <ChannelRuleActions rule={row} />,
              className: "w-full md:w-[280px]",
            },
          ]}
          emptyMessage="Nenhuma regra financeira cadastrada."
          rows={response.meta.channelRules}
        />
      </SectionCard>

      <SectionCard
        title="Lotes de repasse"
        subtitle={`${response.pagination.totalItems} lote(s) encontrado(s) nesta leitura.`}
      >
        <form className="mb-4 grid gap-3 md:grid-cols-4" method="get">
          <select
            className="input-soft"
            defaultValue={filters.status}
            name="status"
          >
            <option value="">Todos os status</option>
            {response.meta.availableStatuses.map((status) => (
              <option key={status} value={status}>
                {formatSettlementStatus(status)}
              </option>
            ))}
          </select>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="page_size" value={filters.pageSize} />
          <button className="btn-primary" type="submit">
            Filtrar
          </button>
        </form>

        <SimpleTable<FinancialSettlementBatch>
          columns={[
            {
              key: "batchReference",
              label: "Lote",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-grafite">{row.batchReference}</p>
                  <p className="text-xs text-black/45">
                    {row.channelName} · {row.linkedReceivablesCount} título(s)
                  </p>
                </div>
              ),
            },
            {
              key: "competency",
              label: "Competência",
              render: (row) => (
                <div className="space-y-1 text-sm">
                  <p>Início: {formatDate(row.competencyStart)}</p>
                  <p>Fim: {formatDate(row.competencyEnd)}</p>
                  <p>Previsto: {formatDate(row.expectedReceiptDate)}</p>
                  <p>Real: {formatDateTime(row.actualReceiptDate)}</p>
                </div>
              ),
            },
            {
              key: "amounts",
              label: "Valores",
              render: (row) => (
                <div className="space-y-1 text-sm">
                  <p>Esperado: {formatCurrency(row.expectedAmount)}</p>
                  <p>Recebido: {formatCurrency(row.receivedAmount)}</p>
                  <p>Regra: {formatSettlementRule(row.expectedSettlementRule)}</p>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <FinancialSettlementStatusBadge status={row.status} />
              ),
            },
            {
              key: "actions",
              label: "Ações",
              render: (row) => <SettlementBatchActions batch={row} />,
              className: "w-full md:w-[280px]",
            },
          ]}
          emptyMessage="Nenhum lote de repasse encontrado."
          rows={response.items}
        />

        <div className="mt-4 flex flex-col gap-3 text-sm text-black/55 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>
            Página {response.pagination.page} de {response.pagination.totalPages}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              aria-disabled={response.pagination.page <= 1}
              className={`btn-secondary ${
                response.pagination.page <= 1
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildPageHref(filters, Math.max(response.pagination.page - 1, 1))}
            >
              Página anterior
            </Link>
            <Link
              aria-disabled={response.pagination.page >= response.pagination.totalPages}
              className={`btn-secondary ${
                response.pagination.page >= response.pagination.totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildPageHref(
                filters,
                Math.min(response.pagination.page + 1, response.pagination.totalPages),
              )}
            >
              Próxima página
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
