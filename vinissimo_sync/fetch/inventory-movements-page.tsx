import Link from "next/link";
import { InventoryAdjustmentForm } from "@/components/inventory/inventory-adjustment-form";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getInventoryMovements } from "@/lib/inventory";
import type { InventoryMovementItem } from "@/types";

export const dynamic = "force-dynamic";

type InventoryMovementsPageProps = {
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

function buildQuery(searchParams?: InventoryMovementsPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const productId = getSingleSearchParam(searchParams?.product_id);
  const movementType = getSingleSearchParam(searchParams?.movement_type);
  const dateFrom = getSingleSearchParam(searchParams?.date_from);
  const dateTo = getSingleSearchParam(searchParams?.date_to);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "15");

  if (productId) query.set("product_id", productId);
  if (movementType) query.set("movement_type", movementType);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      productId,
      movementType,
      dateFrom,
      dateTo,
      page,
      pageSize,
    },
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();

  if (filters.productId) query.set("product_id", filters.productId);
  if (filters.movementType) query.set("movement_type", filters.movementType);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "15");

  return `/inventory/movements?${query.toString()}`;
}

function getMovementLabel(movementType: InventoryMovementItem["movementType"]) {
  switch (movementType) {
    case "purchase_in":
      return "Entrada por compra";
    case "sale_out":
      return "Saída por venda";
    case "adjustment":
      return "Ajuste manual";
    case "cancel_reversal":
      return "Reversão de cancelamento";
    case "return_in":
      return "Retorno";
    default:
      return "Estoque inicial";
  }
}

export default async function InventoryMovementsPage({
  searchParams,
}: InventoryMovementsPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const response = await getInventoryMovements(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Movimentos de estoque</h1>
          <p className="mt-2 text-sm text-black/55">
            Histórico operacional derivado de compras, vendas, reversões e ajustes manuais rastreáveis.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/inventory">
            Voltar ao status
          </Link>
        </div>
      </header>

      <SectionCard
        action={<span className="text-xs uppercase tracking-[0.18em] text-black/35">Obrigatório informar motivo</span>}
        subtitle="Use apenas para ajuste operacional rastreável. Compra e venda continuam sendo registradas nos módulos próprios."
        title="Ajuste manual"
        className="scroll-mt-24"
      >
        <div id="ajuste-manual">
          <InventoryAdjustmentForm products={response.meta.products} />
        </div>
      </SectionCard>

      <SectionCard
        title="Filtros"
        subtitle="Leitura por produto, tipo e janela operacional do movimento."
      >
        <form className="grid gap-3 md:grid-cols-5" method="get">
          <select
            className="input-soft md:col-span-2"
            defaultValue={filters.productId}
            name="product_id"
          >
            <option value="">Todos os produtos</option>
            {response.meta.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.name}
              </option>
            ))}
          </select>

          <select
            className="input-soft"
            defaultValue={filters.movementType}
            name="movement_type"
          >
            <option value="">Todos os tipos</option>
            {response.meta.availableMovementTypes.map((movementType) => (
              <option key={movementType} value={movementType}>
                {getMovementLabel(movementType)}
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

          <div className="md:col-span-5 flex gap-2">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary" href="/inventory/movements">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Histórico de movimentos"
        subtitle={`${response.pagination.totalItems} movimento(s) encontrados nesta leitura.`}
      >
        <SimpleTable<InventoryMovementItem>
          columns={[
            {
              key: "movementDate",
              label: "Quando",
              render: (row) => formatDateTime(row.movementDate),
            },
            {
              key: "productName",
              label: "Produto",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-vinho-950">{row.productSku}</p>
                  <p className="text-sm text-black/60">{row.productName}</p>
                </div>
              ),
            },
            {
              key: "movementType",
              label: "Tipo",
              render: (row) => getMovementLabel(row.movementType),
            },
            {
              key: "quantityDelta",
              label: "Impacto",
              render: (row) => formatDecimal(row.quantityDelta),
            },
            {
              key: "unitCostReference",
              label: "Custo ref.",
              render: (row) => formatDecimal(row.unitCostReference),
            },
            {
              key: "notes",
              label: "Observação",
              render: (row) => row.notes ?? "—",
            },
            {
              key: "createdByName",
              label: "Registrado por",
              render: (row) => row.createdByName ?? "Sistema",
            },
          ]}
          rows={response.items}
          emptyMessage="Nenhum movimento encontrado com os filtros atuais."
        />

        <div className="mt-4 flex items-center justify-between text-sm text-black/55">
          <p>
            Página {response.pagination.page} de {response.pagination.totalPages || 1}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={response.pagination.page <= 1}
              className="btn-secondary"
              href={buildPageHref(filters, Math.max(response.pagination.page - 1, 1))}
            >
              Anterior
            </Link>
            <Link
              aria-disabled={response.pagination.page >= response.pagination.totalPages}
              className="btn-secondary"
              href={buildPageHref(
                filters,
                Math.min(response.pagination.page + 1, Math.max(response.pagination.totalPages, 1)),
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
