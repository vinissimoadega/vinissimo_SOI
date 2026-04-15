import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import type { CrmCustomerMemoryResponse } from "@/types";

function formatCurrency(value: string | null) {
  if (!value) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: CrmCustomerMemoryResponse["customer"]["customerStatus"]) {
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

function renderList(
  items: Array<{ id: string; label: string; value: string; source: string | null }>,
  emptyLabel: string,
) {
  if (items.length === 0) {
    return <p className="text-sm text-black/50">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            {item.label}
          </p>
          <p className="mt-1 text-sm text-grafite">{item.value}</p>
          <p className="mt-1 text-xs text-black/45">
            Origem: {item.source ?? "Não informada"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CustomerMemoryCard({
  memory,
}: {
  memory: CrmCustomerMemoryResponse;
}) {
  const { customer, preferences, lastInteraction, nextSuggestedAction } = memory;

  return (
    <SectionCard
      title="Memória comercial"
      subtitle="Leitura consolidada do cliente para orientar atendimento, pós-venda e reativação."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                Canal principal
              </p>
              <p className="mt-2 text-sm font-medium text-grafite">
                {customer.primaryChannelName ?? "Não definido"}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                Primeira compra
              </p>
              <p className="mt-2 text-sm font-medium text-grafite">
                {formatDateTime(customer.firstPurchaseAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                Última compra
              </p>
              <p className="mt-2 text-sm font-medium text-grafite">
                {formatDateTime(customer.lastPurchaseAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                Pedidos
              </p>
              <p className="mt-2 text-sm font-medium text-grafite">{customer.ordersCount}</p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                Receita total
              </p>
              <p className="mt-2 text-sm font-medium text-grafite">
                {formatCurrency(customer.totalRevenue)}
              </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                Ticket médio
              </p>
              <p className="mt-2 text-sm font-medium text-grafite">
                {formatCurrency(customer.avgTicket)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/45">
                Preferências registradas
              </p>
              {renderList(
                preferences.highlights,
                "Nenhuma preferência operacional registrada.",
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/45">
                Objeções registradas
              </p>
              {renderList(
                preferences.objections,
                "Nenhuma objeção operacional registrada.",
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/45">
                Ocasiões relevantes
              </p>
              {renderList(
                preferences.occasions,
                "Nenhuma ocasião ou contexto de compra registrado.",
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/45">
                Contextos relevantes
              </p>
              {renderList(
                preferences.contexts,
                "Nenhum contexto comercial adicional registrado.",
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
              Status atual do cliente
            </p>
            <div className="mt-3">
              <StatusBadge
                label={statusLabel(customer.customerStatus)}
                tone={customer.customerStatus}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
              Última interação
            </p>
            {lastInteraction ? (
              <div className="mt-2 space-y-2 text-sm text-black/70">
                <p className="font-medium text-grafite">{lastInteraction.reason}</p>
                <p>Status: {lastInteraction.taskStatus}</p>
                <p>Atualizado em: {formatDateTime(lastInteraction.updatedAt)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-black/50">
                Nenhuma interação operacional registrada.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
              Próxima ação sugerida
            </p>
            {nextSuggestedAction ? (
              <div className="mt-2 space-y-2 text-sm text-black/70">
                <p className="font-medium text-grafite">{nextSuggestedAction.label}</p>
                <p>{nextSuggestedAction.reason}</p>
                <p>Vencimento: {formatDateTime(nextSuggestedAction.dueAt)}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-black/50">
                Nenhuma ação pendente ou sugerida neste momento.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
              Observações do cadastro
            </p>
            <p className="mt-2 text-sm text-black/70">
              {customer.notes ?? "Sem observações operacionais registradas."}
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
