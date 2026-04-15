import Link from "next/link";
import { CrmTaskManager } from "@/components/crm/crm-task-manager";
import { KpiCard } from "@/components/kpi-card";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { getCrmOverview } from "@/lib/crm";
import type {
  CrmQueueItem,
  CrmRecurringCustomer,
  CustomerStatus,
  CustomerInteractionStatus,
} from "@/types";

export const dynamic = "force-dynamic";

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

function customerStatusLabel(status: CustomerStatus) {
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

function taskStatusLabel(status: CustomerInteractionStatus) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "done":
      return "Feito";
    case "no_response":
      return "Sem retorno";
    case "dispensed":
      return "Dispensado";
    case "ignored":
      return "Ignorado";
    case "attempt_open":
      return "Tentativa em aberto";
    case "reactivated":
      return "Reativado";
    default:
      return status;
  }
}

function taskStatusTone(status: CustomerInteractionStatus) {
  switch (status) {
    case "done":
    case "reactivated":
      return "success" as const;
    case "no_response":
    case "attempt_open":
      return "medium" as const;
    case "dispensed":
    case "ignored":
      return "low" as const;
    default:
      return "warning" as const;
  }
}

function taskTypeLabel(taskType: CrmQueueItem["taskType"]) {
  switch (taskType) {
    case "followup_pending":
      return "Follow-up pendente";
    case "post_sale_due":
      return "Pós-venda";
    case "review_request_due":
      return "Avaliação";
    case "reactivation_due":
      return "Reativação";
    case "manual_action_due":
      return "Ação manual";
    default:
      return taskType;
  }
}

export default async function CrmPage() {
  const data = await getCrmOverview();
  const customersRequiringAction = Array.from(
    data.queue.reduce(
      (accumulator, item) => {
        if (!accumulator.has(item.customerId)) {
          accumulator.set(item.customerId, {
            customerId: item.customerId,
            customerName: item.customerName,
            customerStatus: item.customerStatus,
            openTasks: 0,
            nextDueAt: item.dueAt,
            nextReason: item.reason,
          });
        }

        const current = accumulator.get(item.customerId)!;
        current.openTasks += 1;

        if (
          item.dueAt &&
          (!current.nextDueAt || new Date(item.dueAt) < new Date(current.nextDueAt))
        ) {
          current.nextDueAt = item.dueAt;
          current.nextReason = item.reason;
        }

        return accumulator;
      },
      new Map<
        string,
        {
          customerId: string;
          customerName: string;
          customerStatus: CustomerStatus;
          openTasks: number;
          nextDueAt: string | null;
          nextReason: string;
        }
      >(),
    ).values(),
  );

  const postSalePending = data.queue.filter((item) => item.taskType === "post_sale_due");
  const reviewPending = data.queue.filter(
    (item) => item.taskType === "review_request_due",
  );
  const reactivationPending = data.queue.filter(
    (item) => item.taskType === "reactivation_due",
  );

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>CRM operacional</h1>
          <p className="mt-2 text-sm text-black/55">
            Cockpit diário para fila de relacionamento, memória comercial, pós-venda
            e recorrência, sem automação externa nesta fase.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/dashboard">
            Voltar ao dashboard
          </Link>
          <Link className="btn-primary" href="/customers">
            Abrir clientes
          </Link>
        </div>
      </header>

      <SectionCard
        title="Resumo operacional"
        subtitle="Fila acionável do dia, clientes que exigem ação e visão básica de recorrência."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Fila aberta"
            tone={data.summary.totalOpenTasks > 0 ? "warning" : "default"}
            value={String(data.summary.totalOpenTasks)}
            helper={`${data.summary.customersRequiringActionCount} cliente(s) exigem ação`}
          />
          <KpiCard
            label="Atrasadas"
            tone={data.summary.overdueTasks > 0 ? "danger" : "default"}
            value={String(data.summary.overdueTasks)}
          />
          <KpiCard
            label="Pós-venda pendente"
            tone={data.summary.postSaleDueCount > 0 ? "warning" : "default"}
            value={String(data.summary.postSaleDueCount)}
          />
          <KpiCard
            label="Avaliações pendentes"
            tone={data.summary.reviewRequestDueCount > 0 ? "warning" : "default"}
            value={String(data.summary.reviewRequestDueCount)}
          />
          <KpiCard
            label="Reativação pendente"
            tone={data.summary.reactivationDueCount > 0 ? "warning" : "default"}
            value={String(data.summary.reactivationDueCount)}
            helper={`${data.summary.recurringCustomersCount} cliente(s) recorrentes na base atual`}
          />
        </div>
      </SectionCard>

      <CrmTaskManager
        customerOptions={data.meta.customers}
        emptyMessage="A fila do dia está vazia nesta leitura. Sem clientes, vendas entregues ou ações manuais abertas, o CRM responde com estado vazio consistente."
        initialTasks={data.queue}
        salesOptions={data.meta.sales}
        subtitle="Fila priorizada com tipo, motivo, vencimento, prioridade e atualização manual das tarefas."
        title="Fila do dia"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Clientes que exigem ação"
          subtitle="Consolidação dos clientes que já aparecem na fila aberta do dia."
        >
          <SimpleTable<{
            customerId: string;
            customerName: string;
            customerStatus: CustomerStatus;
            openTasks: number;
            nextDueAt: string | null;
            nextReason: string;
          }>
            columns={[
              {
                key: "customerName",
                label: "Cliente",
                render: (row) => (
                  <div className="space-y-1">
                    <Link
                      className="font-semibold text-vinho-900 hover:underline"
                      href={`/customers/${row.customerId}`}
                    >
                      {row.customerName}
                    </Link>
                    <StatusBadge
                      label={customerStatusLabel(row.customerStatus)}
                      tone={row.customerStatus}
                    />
                  </div>
                ),
              },
              { key: "openTasks", label: "Ações abertas" },
              {
                key: "nextDueAt",
                label: "Próximo vencimento",
                render: (row) => formatDateTime(row.nextDueAt),
              },
              {
                key: "nextReason",
                label: "Próximo motivo",
              },
            ]}
            emptyMessage="Nenhum cliente requer ação operacional nesta leitura."
            rows={customersRequiringAction}
          />
        </SectionCard>

        <SectionCard
          title="Resumo de recorrência"
          subtitle="Leitura básica dos clientes recorrentes já classificados pelo SOI."
        >
          <SimpleTable<CrmRecurringCustomer>
            columns={[
              { key: "customerName", label: "Cliente" },
              { key: "ordersCount", label: "Pedidos" },
              {
                key: "totalRevenue",
                label: "Receita",
                render: (row) => formatCurrency(row.totalRevenue),
              },
              {
                key: "avgTicket",
                label: "Ticket médio",
                render: (row) => formatCurrency(row.avgTicket),
              },
              {
                key: "lastPurchaseAt",
                label: "Última compra",
                render: (row) => formatDateTime(row.lastPurchaseAt),
              },
            ]}
            emptyMessage="A base atual ainda não tem clientes recorrentes para listar."
            rows={data.recurringCustomers}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Pós-venda pendente"
          subtitle="Pedidos entregues que exigem retorno operacional."
        >
          <SimpleTable<CrmQueueItem>
            columns={[
              {
                key: "customerName",
                label: "Cliente",
                render: (row) => (
                  <Link
                    className="font-semibold text-vinho-900 hover:underline"
                    href={`/customers/${row.customerId}`}
                  >
                    {row.customerName}
                  </Link>
                ),
              },
              {
                key: "saleNumber",
                label: "Pedido",
                render: (row) => row.saleNumber ?? "Sem vínculo",
              },
              {
                key: "dueAt",
                label: "Vencimento",
                render: (row) => formatDateTime(row.dueAt),
              },
              {
                key: "taskStatus",
                label: "Status",
                render: (row) => (
                  <StatusBadge
                    label={taskStatusLabel(row.taskStatus)}
                    tone={taskStatusTone(row.taskStatus)}
                  />
                ),
              },
            ]}
            emptyMessage="Nenhum pós-venda pendente nesta leitura."
            rows={postSalePending}
          />
        </SectionCard>

        <SectionCard
          title="Avaliações pendentes"
          subtitle="Solicitações de avaliação ainda não tratadas pela operação."
        >
          <SimpleTable<CrmQueueItem>
            columns={[
              {
                key: "customerName",
                label: "Cliente",
                render: (row) => (
                  <Link
                    className="font-semibold text-vinho-900 hover:underline"
                    href={`/customers/${row.customerId}`}
                  >
                    {row.customerName}
                  </Link>
                ),
              },
              {
                key: "dueAt",
                label: "Vencimento",
                render: (row) => formatDateTime(row.dueAt),
              },
              {
                key: "taskStatus",
                label: "Status",
                render: (row) => (
                  <StatusBadge
                    label={taskStatusLabel(row.taskStatus)}
                    tone={taskStatusTone(row.taskStatus)}
                  />
                ),
              },
            ]}
            emptyMessage="Nenhuma avaliação pendente nesta leitura."
            rows={reviewPending}
          />
        </SectionCard>

        <SectionCard
          title="Reativação pendente"
          subtitle="Clientes inativos elegíveis para abordagem comercial."
        >
          <SimpleTable<CrmQueueItem>
            columns={[
              {
                key: "customerName",
                label: "Cliente",
                render: (row) => (
                  <div className="space-y-1">
                    <Link
                      className="font-semibold text-vinho-900 hover:underline"
                      href={`/customers/${row.customerId}`}
                    >
                      {row.customerName}
                    </Link>
                    <StatusBadge
                      label={customerStatusLabel(row.customerStatus)}
                      tone={row.customerStatus}
                    />
                  </div>
                ),
              },
              {
                key: "dueAt",
                label: "Próxima ação",
                render: (row) => formatDateTime(row.dueAt),
              },
              {
                key: "taskStatus",
                label: "Status",
                render: (row) => (
                  <StatusBadge
                    label={taskStatusLabel(row.taskStatus)}
                    tone={taskStatusTone(row.taskStatus)}
                  />
                ),
              },
            ]}
            emptyMessage="Nenhum cliente elegível para reativação nesta leitura."
            rows={reactivationPending}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Pendências comerciais relevantes"
        subtitle="Leitura resumida dos itens mais críticos da fila aberta."
      >
        <SimpleTable<CrmQueueItem>
          columns={[
            {
              key: "taskType",
              label: "Tipo",
              render: (row) => taskTypeLabel(row.taskType),
            },
            {
              key: "customerName",
              label: "Cliente",
              render: (row) => (
                <Link
                  className="font-semibold text-vinho-900 hover:underline"
                  href={`/customers/${row.customerId}`}
                >
                  {row.customerName}
                </Link>
              ),
            },
            { key: "reason", label: "Motivo" },
            {
              key: "priority",
              label: "Prioridade",
              render: (row) => (
                <StatusBadge
                  label={row.priority === "high" ? "Alta" : row.priority === "medium" ? "Média" : "Baixa"}
                  tone={row.priority}
                />
              ),
            },
            {
              key: "dueAt",
              label: "Vencimento",
              render: (row) => formatDateTime(row.dueAt),
            },
            {
              key: "taskStatus",
              label: "Status",
              render: (row) => (
                <StatusBadge
                  label={taskStatusLabel(row.taskStatus)}
                  tone={taskStatusTone(row.taskStatus)}
                />
              ),
            },
          ]}
          emptyMessage="Nenhuma pendência comercial relevante foi identificada nesta leitura."
          rows={data.queue.slice(0, 8)}
        />
      </SectionCard>
    </div>
  );
}
