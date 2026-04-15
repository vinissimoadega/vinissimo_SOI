import Link from "next/link";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getExpenses } from "@/lib/expenses";
import type { ExpenseListItem } from "@/types";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getSingleSearchParam(
  value: string | string[] | undefined,
  fallback = "",
): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function buildQuery(searchParams?: ExpensesPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = getSingleSearchParam(searchParams?.search);
  const category = getSingleSearchParam(searchParams?.category);
  const dateFrom = getSingleSearchParam(searchParams?.date_from);
  const dateTo = getSingleSearchParam(searchParams?.date_to);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (category) query.set("category", category);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      search,
      category,
      dateFrom,
      dateTo,
      page,
      pageSize,
    },
  };
}

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();

  if (filters.search) query.set("search", filters.search);
  if (filters.category) query.set("category", filters.category);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "12");

  return `/expenses?${query.toString()}`;
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getCostNatureLabel(value: ExpenseListItem["costNature"]) {
  return value === "fixed" ? "Fixa" : "Variável";
}

function getPaymentMethodLabel(value: ExpenseListItem["paymentMethod"]) {
  switch (value) {
    case "credit_card":
      return "Cartão de crédito";
    case "debit_card":
      return "Cartão de débito";
    case "bank_transfer":
      return "Transferência";
    default:
      return value === "pix" ? "Pix" : value === "cash" ? "Dinheiro" : "Outro";
  }
}

export default async function ExpensesPage({
  searchParams,
}: ExpensesPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const expensesResponse = await getExpenses(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Despesas</h1>
          <p className="mt-2 text-sm text-black/55">
            Fluxo mínimo funcional para registrar, filtrar e revisar despesas operacionais.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/expenses">
            Atualizar leitura
          </Link>
        </div>
      </header>

      <ExpenseForm
        availableCostNatures={expensesResponse.meta.availableCostNatures}
        availablePaymentMethods={expensesResponse.meta.availablePaymentMethods}
        channels={expensesResponse.meta.channels}
      />

      <SectionCard
        title="Filtros"
        subtitle="Busca por categoria, descrição, observação e período."
      >
        <form className="grid gap-3 md:grid-cols-5" method="get">
          <input
            className="input-soft md:col-span-2"
            defaultValue={filters.search}
            name="search"
            placeholder="Buscar por categoria, descrição ou observação"
          />

          <select
            className="input-soft"
            defaultValue={filters.category}
            name="category"
          >
            <option value="">Todas as categorias</option>
            {expensesResponse.meta.categories.map((category) => (
              <option key={category} value={category}>
                {category}
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

          <div className="flex flex-col gap-2 md:col-span-5 sm:flex-row md:justify-end">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary" href="/expenses">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Despesas registradas"
        subtitle={`${expensesResponse.pagination.totalItems} despesa(s) encontrada(s) nesta leitura.`}
      >
        <SimpleTable<ExpenseListItem>
          columns={[
            {
              key: "expenseDate",
              label: "Data",
              render: (row) => formatDate(row.expenseDate),
            },
            {
              key: "category",
              label: "Categoria",
              render: (row) => row.category ?? "Sem categoria",
            },
            {
              key: "description",
              label: "Descrição",
              render: (row) => row.description ?? "—",
            },
            {
              key: "amount",
              label: "Valor",
              render: (row) => formatCurrency(row.amount),
            },
            {
              key: "paymentMethod",
              label: "Pagamento",
              render: (row) => getPaymentMethodLabel(row.paymentMethod),
            },
            {
              key: "costNature",
              label: "Natureza",
              render: (row) => getCostNatureLabel(row.costNature),
            },
            {
              key: "channelName",
              label: "Canal",
              render: (row) => row.channelName ?? "Geral",
            },
          ]}
          emptyMessage="Nenhuma despesa encontrada com os filtros atuais."
          rows={expensesResponse.items}
        />

        <div className="mt-4 flex flex-col gap-3 text-sm text-black/55 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>
            Página {expensesResponse.pagination.page} de{" "}
            {expensesResponse.pagination.totalPages}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              aria-disabled={expensesResponse.pagination.page <= 1}
              className={`btn-secondary ${
                expensesResponse.pagination.page <= 1
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildPageHref(
                filters,
                Math.max(expensesResponse.pagination.page - 1, 1),
              )}
            >
              Página anterior
            </Link>
            <Link
              aria-disabled={
                expensesResponse.pagination.page >= expensesResponse.pagination.totalPages
              }
              className={`btn-secondary ${
                expensesResponse.pagination.page >= expensesResponse.pagination.totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildPageHref(
                filters,
                Math.min(
                  expensesResponse.pagination.page + 1,
                  expensesResponse.pagination.totalPages,
                ),
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
