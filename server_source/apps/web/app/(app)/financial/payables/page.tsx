import Link from "next/link";
import { FinancialTabs } from "@/components/financial/financial-tabs";
import { PayableActions } from "@/components/financial/financial-actions";
import {
  FinancialPayableStatusBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPayableStatus,
} from "@/components/financial/financial-ui";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getFinancialPayables } from "@/lib/financial";
import type { FinancialPayableItem } from "@/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function single(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function buildQuery(searchParams?: PageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = single(searchParams?.search);
  const supplierId = single(searchParams?.supplier_id);
  const status = single(searchParams?.status);
  const dateFrom = single(searchParams?.date_from);
  const dateTo = single(searchParams?.date_to);
  const page = single(searchParams?.page, "1");
  const pageSize = single(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (supplierId) query.set("supplier_id", supplierId);
  if (status) query.set("status", status);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  query.set("page", page);
  query.set("page_size", pageSize);

  return {
    query,
    filters: { search, supplierId, status, dateFrom, dateTo, page, pageSize },
  };
}

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.supplierId) query.set("supplier_id", filters.supplierId);
  if (filters.status) query.set("status", filters.status);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize);
  return `/financial/payables?${query.toString()}`;
}

export default async function FinancialPayablesPage({
  searchParams,
}: PageProps) {
  const { query, filters } = buildQuery(searchParams);
  const response = await getFinancialPayables(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Contas a pagar</h1>
          <p className="mt-2 text-sm text-black/55">
            Saídas operacionais geradas por compras, despesas e ajustes gerenciais.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/financial/payables">
            Atualizar leitura
          </Link>
        </div>
      </header>

      <FinancialTabs />

      <SectionCard
        title="Filtros"
        subtitle="Refine por fornecedor, status, período e texto operacional."
      >
        <form className="grid gap-3 md:grid-cols-6" method="get">
          <input
            className="input-soft md:col-span-2"
            defaultValue={filters.search}
            name="search"
            placeholder="Buscar por título, fornecedor ou categoria"
          />
          <select
            className="input-soft"
            defaultValue={filters.supplierId}
            name="supplier_id"
          >
            <option value="">Todos os fornecedores</option>
            {response.meta.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <select
            className="input-soft"
            defaultValue={filters.status}
            name="status"
          >
            <option value="">Todos os status</option>
            {response.meta.availableStatuses.map((status) => (
              <option key={status} value={status}>
                {formatPayableStatus(status)}
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
          <div className="flex flex-col gap-2 md:col-span-6 sm:flex-row md:justify-end">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary" href="/financial/payables">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Títulos a pagar"
        subtitle={`${response.pagination.totalItems} conta(s) a pagar nesta leitura.`}
      >
        <SimpleTable<FinancialPayableItem>
          columns={[
            {
              key: "payableNumber",
              label: "Título",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-grafite">{row.payableNumber}</p>
                  <p className="text-xs text-black/45">{row.sourceLabel}</p>
                </div>
              ),
            },
            {
              key: "counterpartyName",
              label: "Contraparte",
              render: (row) => (
                <div className="space-y-1">
                  <p>{row.supplierName ?? row.counterpartyName ?? "—"}</p>
                  <p className="text-xs text-black/45">{row.category ?? "Sem categoria"}</p>
                </div>
              ),
            },
            {
              key: "amount",
              label: "Valores",
              render: (row) => (
                <div className="space-y-1 text-sm">
                  <p>Valor: {formatCurrency(row.amount)}</p>
                  <p>Pago: {formatCurrency(row.amountPaid)}</p>
                  <p>Natureza: {row.costNature === "fixed" ? "Fixa" : row.costNature === "variable" ? "Variável" : "—"}</p>
                </div>
              ),
            },
            {
              key: "dates",
              label: "Datas",
              render: (row) => (
                <div className="space-y-1 text-sm">
                  <p>Competência: {formatDateTime(row.competencyDate)}</p>
                  <p>Vencimento: {formatDate(row.dueDate)}</p>
                  <p>Pagamento real: {formatDateTime(row.actualPaymentDate)}</p>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => <FinancialPayableStatusBadge status={row.status} />,
            },
            {
              key: "actions",
              label: "Ações",
              render: (row) => <PayableActions payable={row} />,
              className: "w-full md:w-[280px]",
            },
          ]}
          emptyMessage="Nenhuma conta a pagar encontrada com os filtros atuais."
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
