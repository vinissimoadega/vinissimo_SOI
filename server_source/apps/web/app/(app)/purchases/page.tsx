import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getPurchases } from "@/lib/purchases";
import type { PurchaseListItem } from "@/types";

export const dynamic = "force-dynamic";

type PurchasesPageProps = {
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

function buildQuery(searchParams?: PurchasesPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = getSingleSearchParam(searchParams?.search);
  const supplierId = getSingleSearchParam(searchParams?.supplier_id);
  const productId = getSingleSearchParam(searchParams?.product_id);
  const dateFrom = getSingleSearchParam(searchParams?.date_from);
  const dateTo = getSingleSearchParam(searchParams?.date_to);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (supplierId) query.set("supplier_id", supplierId);
  if (productId) query.set("product_id", productId);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      search,
      supplierId,
      productId,
      dateFrom,
      dateTo,
      page,
      pageSize,
    },
  };
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

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();

  if (filters.search) query.set("search", filters.search);
  if (filters.supplierId) query.set("supplier_id", filters.supplierId);
  if (filters.productId) query.set("product_id", filters.productId);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "12");

  return `/purchases?${query.toString()}`;
}

export default async function PurchasesPage({
  searchParams,
}: PurchasesPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const purchasesResponse = await getPurchases(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Compras</h1>
          <p className="mt-2 text-sm text-black/55">
            Entradas com múltiplos itens, custo real por linha e reflexo direto no custo operacional.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/purchases">
            Atualizar leitura
          </Link>
          <Link className="btn-primary" href="/purchases/new">
            Nova compra
          </Link>
        </div>
      </header>

      <SectionCard
        title="Filtros"
        subtitle="Leitura por fornecedor, produto e janela operacional de lançamento."
      >
        <form className="grid gap-3 md:grid-cols-6" method="get">
          <input
            className="input-soft md:col-span-2"
            defaultValue={filters.search}
            name="search"
            placeholder="Buscar por nº compra ou fornecedor"
          />

          <select
            className="input-soft"
            defaultValue={filters.supplierId}
            name="supplier_id"
          >
            <option value="">Todos os fornecedores</option>
            {purchasesResponse.meta.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <select
            className="input-soft"
            defaultValue={filters.productId}
            name="product_id"
          >
            <option value="">Todos os produtos</option>
            {purchasesResponse.meta.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.name}
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

          <div className="flex gap-2">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary flex-1" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary flex-1" href="/purchases">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Compras lançadas"
        subtitle={`${purchasesResponse.pagination.totalItems} compra(s) encontrada(s) nesta leitura.`}
      >
        <SimpleTable<PurchaseListItem>
          columns={[
            {
              key: "purchaseNumber",
              label: "Nº compra",
              render: (row) => (
                <div className="space-y-1">
                  <Link
                    className="font-semibold text-vinho-900 hover:underline"
                    href={`/purchases/${row.id}`}
                  >
                    {row.purchaseNumber}
                  </Link>
                  <p className="text-xs text-black/45">
                    {formatDate(row.purchaseDate)}
                  </p>
                </div>
              ),
            },
            {
              key: "supplierName",
              label: "Fornecedor",
              render: (row) => row.supplierName ?? "Não informado",
            },
            {
              key: "itemsCount",
              label: "Itens",
            },
            {
              key: "totalAmount",
              label: "Total",
              render: (row) => formatCurrency(row.totalAmount),
            },
            {
              key: "createdByName",
              label: "Registro",
              render: (row) => row.createdByName ?? "Sistema",
            },
            {
              key: "actions",
              label: "Ações",
              render: (row) => (
                <Link className="btn-secondary h-9 px-3" href={`/purchases/${row.id}`}>
                  Detalhe
                </Link>
              ),
              className: "w-[160px]",
            },
          ]}
          emptyMessage="Nenhuma compra encontrada com os filtros atuais."
          rows={purchasesResponse.items}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-black/55">
          <p>
            Página {purchasesResponse.pagination.page} de {purchasesResponse.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={purchasesResponse.pagination.page <= 1}
              className={`btn-secondary ${
                purchasesResponse.pagination.page <= 1
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildPageHref(filters, Math.max(purchasesResponse.pagination.page - 1, 1))}
            >
              Página anterior
            </Link>
            <Link
              aria-disabled={
                purchasesResponse.pagination.page >= purchasesResponse.pagination.totalPages
              }
              className={`btn-secondary ${
                purchasesResponse.pagination.page >= purchasesResponse.pagination.totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
              href={buildPageHref(
                filters,
                Math.min(
                  purchasesResponse.pagination.page + 1,
                  purchasesResponse.pagination.totalPages,
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
