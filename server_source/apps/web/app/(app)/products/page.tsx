import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { CategoryManager } from "@/components/products/category-manager";
import { ProductStatusToggle } from "@/components/products/product-status-toggle";
import { getCategories, getProducts } from "@/lib/products";
import type { ProductListItem } from "@/types";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
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

function buildQuery(searchParams?: ProductsPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = getSingleSearchParam(searchParams?.search);
  const categoryId = getSingleSearchParam(searchParams?.category_id);
  const isActive = getSingleSearchParam(searchParams?.is_active);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (categoryId) query.set("category_id", categoryId);
  if (isActive) query.set("is_active", isActive);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      search,
      categoryId,
      isActive,
      page,
      pageSize,
    },
  };
}

function formatCurrency(value: string | null) {
  if (!value) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatQuantity(value: string | null) {
  if (!value) return "—";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();

  if (filters.search) query.set("search", filters.search);
  if (filters.categoryId) query.set("category_id", filters.categoryId);
  if (filters.isActive) query.set("is_active", filters.isActive);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "12");

  return `/products?${query.toString()}`;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const [productsResponse, categoriesResponse] = await Promise.all([
    getProducts(query),
    getCategories(),
  ]);

  const rows = productsResponse.items;

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Produtos</h1>
          <p className="mt-2 text-sm text-black/55">
            Cadastro-mestre dos vinhos, com SKU único, origem, uvas, descrição comercial e acesso rápido para corrigir o estoque real.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/products">
            Ver todos
          </Link>
          <Link className="btn-primary" href="/products/new">
            Novo produto
          </Link>
        </div>
      </header>

      <SectionCard
        title="Filtros"
        subtitle="Busca consistente por SKU exato, nome parcial, país, região, uvas ou descrição do vinho."
      >
        <form className="grid gap-3 md:grid-cols-4" method="get">
          <input
            className="input-soft"
            defaultValue={filters.search}
            name="search"
            placeholder="Buscar por SKU, nome, país, região, uvas ou descrição"
          />
          <select
            className="input-soft"
            defaultValue={filters.categoryId}
            name="category_id"
          >
            <option value="">Todas as categorias</option>
            {categoriesResponse.items.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select className="input-soft" defaultValue={filters.isActive} name="is_active">
            <option value="">Ativos e inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary flex-1" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary flex-1" href="/products">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard
          title="Mix cadastrado"
          subtitle={`${productsResponse.pagination.totalItems} produto(s) encontrado(s) nesta leitura.`}
        >
          <SimpleTable<ProductListItem>
            columns={[
              { key: "sku", label: "SKU" },
              {
                key: "name",
                label: "Produto",
                render: (row) => (
                  <div className="space-y-1">
                    <Link
                      className="font-semibold text-vinho-900 hover:underline"
                      href={`/products/${row.id}`}
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-black/45">
                      {[
                        row.countryName,
                        row.regionName,
                        row.grapeComposition,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Origem e uvas ainda não informadas"}
                    </p>
                    <p className="text-xs text-black/45">
                      {row.channelPricesCount} canal(is) com preço-alvo
                    </p>
                  </div>
                ),
              },
              {
                key: "categoryName",
                label: "Categoria",
                render: (row) => row.categoryName ?? "Sem categoria",
              },
              {
                key: "baseUnitCost",
                label: "Custo base",
                render: (row) => formatCurrency(row.baseUnitCost),
              },
              {
                key: "initialStockQty",
                label: "Estoque base",
                render: (row) => formatQuantity(row.initialStockQty),
              },
              {
                key: "isActive",
                label: "Status",
                render: (row) => (
                  <StatusBadge
                    label={row.isActive ? "Ativo" : "Inativo"}
                    tone={row.isActive ? "success" : "inativo"}
                  />
                ),
              },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Link className="btn-secondary h-9 px-3" href={`/products/${row.id}`}>
                      Editar
                    </Link>
                    <Link
                      className="btn-secondary h-9 px-3"
                      href={`/inventory/movements?product_id=${row.id}#ajuste-manual`}
                    >
                      Corrigir saldo
                    </Link>
                    <ProductStatusToggle productId={row.id} isActive={row.isActive} />
                  </div>
                ),
                className: "w-[320px]",
              },
            ]}
            emptyMessage="Nenhum produto encontrado com os filtros atuais."
            rows={rows}
          />

          <div className="mt-4 flex flex-col gap-3 text-sm text-black/55 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p>
              Página {productsResponse.pagination.page} de {productsResponse.pagination.totalPages}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                aria-disabled={productsResponse.pagination.page <= 1}
                className={`btn-secondary ${
                  productsResponse.pagination.page <= 1
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
                href={buildPageHref(filters, Math.max(productsResponse.pagination.page - 1, 1))}
              >
                Página anterior
              </Link>
              <Link
                aria-disabled={
                  productsResponse.pagination.page >= productsResponse.pagination.totalPages
                }
                className={`btn-secondary ${
                  productsResponse.pagination.page >= productsResponse.pagination.totalPages
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
                href={buildPageHref(
                  filters,
                  Math.min(
                    productsResponse.pagination.page + 1,
                    productsResponse.pagination.totalPages,
                  ),
                )}
              >
                Próxima página
              </Link>
            </div>
          </div>
        </SectionCard>

        <CategoryManager categories={categoriesResponse.items} />
      </div>
    </div>
  );
}
