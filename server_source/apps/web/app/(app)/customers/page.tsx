import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { CustomerStatusToggle } from "@/components/customers/customer-status-toggle";
import { getCustomers } from "@/lib/customers";
import type { CustomerListItem } from "@/types";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
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

function buildQuery(searchParams?: CustomersPageProps["searchParams"]) {
  const query = new URLSearchParams();
  const search = getSingleSearchParam(searchParams?.search);
  const customerStatus = getSingleSearchParam(searchParams?.customer_status);
  const channelId = getSingleSearchParam(searchParams?.channel_id);
  const page = getSingleSearchParam(searchParams?.page, "1");
  const pageSize = getSingleSearchParam(searchParams?.page_size, "12");

  if (search) query.set("search", search);
  if (customerStatus) query.set("customer_status", customerStatus);
  if (channelId) query.set("channel_id", channelId);
  if (page) query.set("page", page);
  if (pageSize) query.set("page_size", pageSize);

  return {
    query,
    filters: {
      search,
      customerStatus,
      channelId,
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
  if (filters.customerStatus) {
    query.set("customer_status", filters.customerStatus);
  }
  if (filters.channelId) query.set("channel_id", filters.channelId);
  query.set("page", String(page));
  query.set("page_size", filters.pageSize || "12");

  return `/customers?${query.toString()}`;
}

function formatCurrency(value: string | null) {
  if (!value) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: CustomerListItem["customerStatus"]) {
  switch (status) {
    case "lead":
      return "Lead";
    case "novo":
      return "Novo";
    case "recorrente":
      return "Recorrente";
    case "inativo":
      return "Inativo";
    default:
      return status;
  }
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const { query, filters } = buildQuery(searchParams);
  const customersResponse = await getCustomers(query);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Clientes</h1>
          <p className="mt-2 text-sm text-black/55">
            CRM operacional da Viníssimo com status do SOI, métricas de compra e
            histórico de relacionamento.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/customers">
            Ver todos
          </Link>
          <Link className="btn-primary" href="/customers/new">
            Novo cliente
          </Link>
        </div>
      </header>

      <SectionCard
        title="Filtros"
        subtitle="Busca por nome, telefone, status do cliente e canal de aquisição."
      >
        <form className="grid gap-3 md:grid-cols-4" method="get">
          <input
            className="input-soft"
            defaultValue={filters.search}
            name="search"
            placeholder="Buscar por nome, telefone ou email"
          />
          <select
            className="input-soft"
            defaultValue={filters.customerStatus}
            name="customer_status"
          >
            <option value="">Todos os status</option>
            {customersResponse.meta.availableStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          <select
            className="input-soft"
            defaultValue={filters.channelId}
            name="channel_id"
          >
            <option value="">Todos os canais</option>
            {customersResponse.meta.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.channelName}
              </option>
            ))}
          </select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="page_size" value={filters.pageSize} />
            <button className="btn-primary flex-1" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary flex-1" href="/customers">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Base de clientes"
        subtitle={`${customersResponse.pagination.totalItems} cliente(s) encontrados nesta leitura.`}
      >
        <SimpleTable<CustomerListItem>
          columns={[
            {
              key: "fullName",
              label: "Cliente",
              render: (row) => (
                <div className="space-y-1">
                  <Link
                    className="font-semibold text-vinho-900 hover:underline"
                    href={`/customers/${row.id}`}
                  >
                    {row.fullName}
                  </Link>
                  <p className="text-xs text-black/45">
                    {row.email ?? "Sem email"} · {row.customerCode ?? "Sem código"}
                  </p>
                </div>
              ),
            },
            {
              key: "phone",
              label: "Telefone",
              render: (row) => row.phone ?? "—",
            },
            {
              key: "acquisitionChannelName",
              label: "Origem",
              render: (row) => row.acquisitionChannelName ?? "Não informada",
            },
            {
              key: "metrics",
              label: "Métricas",
              render: (row) => (
                <div className="space-y-1 text-sm">
                  <p>Pedidos: {row.ordersCount}</p>
                  <p>Receita: {formatCurrency(row.totalRevenue)}</p>
                  <p>Última compra: {formatDate(row.lastPurchaseAt)}</p>
                </div>
              ),
            },
            {
              key: "customerStatus",
              label: "Status",
              render: (row) => (
                <div className="space-y-2">
                  <StatusBadge
                    label={statusLabel(row.customerStatus)}
                    tone={row.customerStatus}
                  />
                  {!row.isActive ? (
                    <p className="text-xs text-black/45">Cadastro inativo</p>
                  ) : null}
                </div>
              ),
            },
            {
              key: "actions",
              label: "Ações",
              className: "w-[220px]",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Link className="btn-secondary h-9 px-3" href={`/customers/${row.id}`}>
                    Editar
                  </Link>
                  <CustomerStatusToggle customerId={row.id} isActive={row.isActive} />
                </div>
              ),
            },
          ]}
          emptyMessage="Nenhum cliente encontrado com os filtros atuais."
          rows={customersResponse.items}
        />

        <div className="mt-4 flex flex-col gap-3 text-sm text-black/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Página {customersResponse.pagination.page} de{" "}
            {customersResponse.pagination.totalPages}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              aria-disabled={customersResponse.pagination.page <= 1}
              className="btn-secondary h-9 px-3"
              href={buildPageHref(
                filters,
                Math.max(customersResponse.pagination.page - 1, 1),
              )}
            >
              Anterior
            </Link>
            <Link
              aria-disabled={
                customersResponse.pagination.page >=
                customersResponse.pagination.totalPages
              }
              className="btn-secondary h-9 px-3"
              href={buildPageHref(
                filters,
                Math.min(
                  customersResponse.pagination.page + 1,
                  customersResponse.pagination.totalPages,
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
