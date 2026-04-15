import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { getSales } from "@/lib/sales";
import type {
  SaleListItem,
  SaleOrderStatus,
  SalePaymentStatus,
} from "@/types";

export const dynamic = "force-dynamic";

type SalesPageProps = {
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

function buildQuery(searchParams?: SalesPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = getSingleSearchParam(searchParams?.search);
  const channelId = getSingleSearchParam(searchParams?.channel_id);
  const customerId = getSingleSearchParam(searchParams?.customer_id);
  const productId = getSingleSearchParam(searchParams?.product_id);
  const orderStatus = getSingleSearchParam(searchParams?.order_status);
  const dateFrom = getSingleSearchParam(searchParams?.date_from);
  const dateTo = getSingleSearchParam(searchParams?.date_to);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (channelId) query.set("channel_id", channelId);
  if (customerId) query.set("customer_id", customerId);
  if (productId) query.set("product_id", productId);
  if (orderStatus) query.set("order_status", orderStatus);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      search,
      channelId,
      customerId,
      productId,
      orderStatus,
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

function formatMargin(value: string | null) {
  if (!value) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function getPaymentStatusUi(status: SalePaymentStatus) {
  switch (status) {
    case "paid":
      return { label: "Pago", tone: "success" as const };
    case "pending_confirmation":
      return { label: "Aguardando confirmação", tone: "warning" as const };
    case "failed":
      return { label: "Falhou", tone: "high" as const };
    case "refunded":
      return { label: "Estornado", tone: "medium" as const };
    default:
      return { label: "Não pago", tone: "low" as const };
  }
}

function getStatusUi(status: SaleOrderStatus) {
  switch (status) {
    case "delivered":
      return { label: "Entregue", tone: "success" as const };
    case "canceled":
      return { label: "Cancelado", tone: "high" as const };
    default:
      return { label: "Pendente", tone: "warning" as const };
  }
}

function getStatusLabel(status: SaleOrderStatus) {
  return getStatusUi(status).label;
}

function buildPageHref(
  filters: ReturnType<typeof buildQuery>["filters"],
  page: number,
) {
  const query = new URLSearchParams();

  if (filters.search) query.set("search", filters.search);
  if (filters.channelId) query.set("channel_id", filters.channelId);
  if (filters.customerId) query.set("customer_id", filters.customerId);
  if (filters.productId) query.set("product_id", filters.productId);
  if (filters.orderStatus) query.set("order_status", filters.orderStatus);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "12");

  return `/sales?${query.toString()}`;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const salesResponse = await getSales(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Vendas</h1>
          <p className="mt-2 text-sm text-black/55">
            Pedidos multicanal com receita, custo, lucro, margem e saída operacional de estoque.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/sales">
            Atualizar leitura
          </Link>
          <Link className="btn-secondary" href="/sales/whatsapp">
            Venda rápida WhatsApp
          </Link>
          <Link className="btn-primary" href="/sales/new">
            Nova venda
          </Link>
        </div>
      </header>

      <SectionCard
        title="Filtros"
        subtitle="Leitura por canal, cliente, produto, status e janela operacional do pedido."
      >
        <form className="grid gap-3 md:grid-cols-8" method="get">
          <input
            className="input-soft md:col-span-2"
            defaultValue={filters.search}
            name="search"
            placeholder="Buscar por nº venda, cliente ou telefone"
          />

          <select
            className="input-soft"
            defaultValue={filters.channelId}
            name="channel_id"
          >
            <option value="">Todos os canais</option>
            {salesResponse.meta.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.channelName}
              </option>
            ))}
          </select>

          <select
            className="input-soft"
            defaultValue={filters.customerId}
            name="customer_id"
          >
            <option value="">Todos os clientes</option>
            {salesResponse.meta.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName}
              </option>
            ))}
          </select>

          <select
            className="input-soft"
            defaultValue={filters.productId}
            name="product_id"
          >
            <option value="">Todos os produtos</option>
            {salesResponse.meta.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.name}
              </option>
            ))}
          </select>

          <select
            className="input-soft"
            defaultValue={filters.orderStatus}
            name="order_status"
          >
            <option value="">Todos os status</option>
            {salesResponse.meta.availableStatuses.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
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
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary flex-1" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary flex-1" href="/sales">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Pedidos lançados"
        subtitle={`${salesResponse.pagination.totalItems} venda(s) encontrada(s) nesta leitura.`}
      >
        <SimpleTable<SaleListItem>
          columns={[
            {
              key: "saleNumber",
              label: "Nº venda",
              render: (row) => (
                <div className="space-y-1">
                  <Link
                    className="font-semibold text-vinho-900 hover:underline"
                    href={`/sales/${row.id}`}
                  >
                    {row.saleNumber}
                  </Link>
                  <p className="text-xs text-black/45">{formatDate(row.saleDate)}</p>
                </div>
              ),
            },
            {
              key: "customerName",
              label: "Cliente",
              render: (row) => row.customerName ?? "Venda sem cliente",
            },
            {
              key: "channelName",
              label: "Canal",
            },
            {
              key: "orderStatus",
              label: "Status",
              render: (row) => {
                const statusUi = getStatusUi(row.orderStatus);
                return <StatusBadge label={statusUi.label} tone={statusUi.tone} />;
              },
            },
            {
              key: "paymentStatus",
              label: "Pagamento",
              render: (row) => {
                const paymentStatusUi = getPaymentStatusUi(row.paymentStatus);
                return (
                  <StatusBadge
                    label={paymentStatusUi.label}
                    tone={paymentStatusUi.tone}
                  />
                );
              },
            },
            {
              key: "netRevenue",
              label: "Receita líquida",
              render: (row) => formatCurrency(row.netRevenue),
            },
            {
              key: "grossProfit",
              label: "Lucro",
              render: (row) => (
                <div className="space-y-1">
                  <span>{formatCurrency(row.grossProfit)}</span>
                  <p className="text-xs text-black/45">
                    Margem {formatMargin(row.grossMarginPct)}
                  </p>
                </div>
              ),
            },
            {
              key: "actions",
              label: "Ações",
              render: (row) => (
                <Link className="btn-secondary h-9 px-3" href={`/sales/${row.id}`}>
                  Detalhe
                </Link>
              ),
              className: "w-[160px]",
            },
          ]}
          emptyMessage="Nenhuma venda encontrada com os filtros atuais."
          rows={salesResponse.items}
        />

        <div className="mt-4 flex items-center justify-between text-sm text-black/55">
          <p>
            Página {salesResponse.pagination.page} de{" "}
            {salesResponse.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={salesResponse.pagination.page <= 1}
              className="btn-secondary h-9 px-3 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              href={buildPageHref(filters, Math.max(1, salesResponse.pagination.page - 1))}
            >
              Anterior
            </Link>
            <Link
              aria-disabled={
                salesResponse.pagination.page >= salesResponse.pagination.totalPages
              }
              className="btn-secondary h-9 px-3 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              href={buildPageHref(
                filters,
                Math.min(
                  salesResponse.pagination.totalPages,
                  salesResponse.pagination.page + 1,
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
