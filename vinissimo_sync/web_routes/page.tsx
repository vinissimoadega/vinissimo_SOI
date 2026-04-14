import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { getInventoryStatus } from "@/lib/inventory";
import type { InventoryStatusItem, InventoryStockStatus } from "@/types";

export const dynamic = "force-dynamic";

type InventoryPageProps = {
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

function buildQuery(searchParams?: InventoryPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = getSingleSearchParam(searchParams?.search);
  const categoryId = getSingleSearchParam(searchParams?.category_id);
  const stockStatus = getSingleSearchParam(searchParams?.stock_status);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (categoryId) query.set("category_id", categoryId);
  if (stockStatus) query.set("stock_status", stockStatus);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      search,
      categoryId,
      stockStatus,
      page,
      pageSize,
    },
  };
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

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function getStatusLabel(status: InventoryStockStatus) {
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

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();

  if (filters.search) query.set("search", filters.search);
  if (filters.categoryId) query.set("category_id", filters.categoryId);
  if (filters.stockStatus) query.set("stock_status", filters.stockStatus);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "12");

  return `/inventory?${query.toString()}`;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const inventoryResponse = await getInventoryStatus(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Estoque</h1>
          <p className="mt-2 text-sm text-black/55">
            Leitura derivada dos movimentos, com cobertura, mínimo usado, compra sugerida e capital empatado.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/inventory/movements">
            Ver movimentos
          </Link>
          <Link className="btn-primary" href="/inventory/movements#ajuste-manual">
            Ajuste manual
          </Link>
        </div>
      </header>

      <SectionCard
        title="Parâmetros atuais"
        subtitle="Base de cálculo do mínimo sugerido usada nesta leitura operacional."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-soft p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Lead time</p>
            <p className="mt-2 text-2xl font-semibold text-vinho-950">
              {inventoryResponse.meta.currentSettings.replenishmentLeadTimeDays} dias
            </p>
          </div>
          <div className="surface-soft p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Estoque de segurança</p>
            <p className="mt-2 text-2xl font-semibold text-vinho-950">
              {inventoryResponse.meta.currentSettings.stockSafetyDays} dias
            </p>
          </div>
          <div className="surface-soft p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Regra do mínimo usado</p>
            <p className="mt-2 text-sm text-black/60">
              O sistema usa sempre o maior entre o mínimo manual e o mínimo sugerido por giro recente.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Filtros"
        subtitle="Busque por SKU, produto, categoria ou semáforo operacional."
      >
        <form className="grid gap-3 md:grid-cols-5" method="get">
          <input
            className="input-soft md:col-span-2"
            defaultValue={filters.search}
            name="search"
            placeholder="Pesquisar por SKU ou produto"
          />

          <select
            className="input-soft"
            defaultValue={filters.categoryId}
            name="category_id"
          >
            <option value="">Todas as categorias</option>
            {inventoryResponse.meta.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="input-soft"
            defaultValue={filters.stockStatus}
            name="stock_status"
          >
            <option value="">Todos os semáforos</option>
            {inventoryResponse.meta.availableStatuses.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary flex-1" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary flex-1" href="/inventory">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Status por produto"
        subtitle={`${inventoryResponse.pagination.totalItems} produto(s) nesta leitura de estoque.`}
      >
        <SimpleTable<InventoryStatusItem>
          columns={[
            {
              key: "sku",
              label: "Produto",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-vinho-950">{row.sku}</p>
                  <p className="text-sm text-black/60">{row.name}</p>
                </div>
              ),
            },
            {
              key: "categoryName",
              label: "Categoria",
              render: (row) => row.categoryName ?? "Sem categoria",
            },
            {
              key: "currentStockQty",
              label: "Estoque atual",
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
              key: "suggestedPurchaseQty",
              label: "Compra sugerida",
              render: (row) => formatDecimal(row.suggestedPurchaseQty),
            },
            {
              key: "tiedUpCapital",
              label: "Capital empatado",
              render: (row) => formatCurrency(row.tiedUpCapital),
            },
            {
              key: "stockStatus",
              label: "Semáforo",
              render: (row) => (
                <StatusBadge
                  label={getStatusLabel(row.stockStatus)}
                  tone={row.stockStatus}
                />
              ),
            },
            {
              key: "id",
              label: "Ações",
              render: (row) => (
                <div className="flex flex-col gap-1 text-sm">
                  <Link
                    className="font-medium text-vinho-900 hover:underline"
                    href={`/inventory/movements?product_id=${row.id}`}
                  >
                    Ver movimentos
                  </Link>
                  <Link
                    className="font-medium text-vinho-900 hover:underline"
                    href={`/inventory/products/${row.id}/min-prices`}
                  >
                    Preços mínimos
                  </Link>
                </div>
              ),
            },
          ]}
          rows={inventoryResponse.items}
          emptyMessage="Nenhum produto encontrado com os filtros atuais."
        />

        <div className="mt-4 flex items-center justify-between text-sm text-black/55">
          <p>
            Página {inventoryResponse.pagination.page} de {inventoryResponse.pagination.totalPages || 1}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={inventoryResponse.pagination.page <= 1}
              className="btn-secondary"
              href={buildPageHref(filters, Math.max(inventoryResponse.pagination.page - 1, 1))}
            >
              Anterior
            </Link>
            <Link
              aria-disabled={inventoryResponse.pagination.page >= inventoryResponse.pagination.totalPages}
              className="btn-secondary"
              href={buildPageHref(
                filters,
                Math.min(
                  inventoryResponse.pagination.page + 1,
                  Math.max(inventoryResponse.pagination.totalPages, 1),
                ),
              )}
            >
              Próxima
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
