"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { clientApiRequest } from "@/lib/client-api";
import type {
  CrmCustomerOption,
  CrmQueueItem,
  CrmSaleOption,
  CustomerInteractionPriority,
  CustomerInteractionStatus,
  CustomerInteractionType,
} from "@/types";

type CrmTaskManagerProps = {
  title: string;
  subtitle: string;
  initialTasks: CrmQueueItem[];
  customerOptions: CrmCustomerOption[];
  salesOptions: CrmSaleOption[];
  lockedCustomerId?: string;
  lockedCustomerLabel?: string;
  emptyMessage?: string;
};

type TaskDraft = {
  taskStatus: CustomerInteractionStatus;
  notes: string;
};

const TASK_TYPE_OPTIONS: Array<{
  value: CustomerInteractionType;
  label: string;
}> = [
  { value: "followup_pending", label: "Follow-up pendente" },
  { value: "post_sale_due", label: "Pós-venda pendente" },
  { value: "review_request_due", label: "Avaliação pendente" },
  { value: "reactivation_due", label: "Reativação pendente" },
  { value: "manual_action_due", label: "Ação manual" },
];

const PRIORITY_OPTIONS: Array<{
  value: CustomerInteractionPriority;
  label: string;
}> = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

const STATUS_LABELS: Record<CustomerInteractionStatus, string> = {
  pending: "Pendente",
  done: "Feito",
  no_response: "Sem retorno",
  dispensed: "Dispensado",
  ignored: "Ignorado",
  attempt_open: "Tentativa em aberto",
  reactivated: "Reativado",
};

const STATUS_TONES: Record<
  CustomerInteractionStatus,
  "warning" | "success" | "medium" | "low"
> = {
  pending: "warning",
  done: "success",
  no_response: "medium",
  dispensed: "low",
  ignored: "low",
  attempt_open: "medium",
  reactivated: "success",
};

const PRIORITY_TONES: Record<
  CustomerInteractionPriority,
  "high" | "medium" | "low"
> = {
  high: "high",
  medium: "medium",
  low: "low",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getStatusOptions(taskType: CustomerInteractionType) {
  switch (taskType) {
    case "post_sale_due":
      return ["pending", "done", "no_response", "dispensed"] as const;
    case "review_request_due":
      return ["pending", "done", "ignored"] as const;
    case "reactivation_due":
      return [
        "pending",
        "attempt_open",
        "reactivated",
        "no_response",
        "dispensed",
      ] as const;
    default:
      return ["pending", "done", "no_response", "dispensed"] as const;
  }
}

function buildInitialDrafts(items: CrmQueueItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        taskStatus: item.taskStatus,
        notes: item.notes ?? "",
      },
    ]),
  ) as Record<string, TaskDraft>;
}

export function CrmTaskManager({
  title,
  subtitle,
  initialTasks,
  customerOptions,
  salesOptions,
  lockedCustomerId,
  lockedCustomerLabel,
  emptyMessage = "Nenhuma tarefa operacional registrada nesta leitura.",
}: CrmTaskManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialTasks);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>(
    buildInitialDrafts(initialTasks),
  );
  const [form, setForm] = useState({
    customerId: lockedCustomerId ?? "",
    salesOrderId: "",
    taskType: "manual_action_due" as CustomerInteractionType,
    priority: "medium" as CustomerInteractionPriority,
    dueAt: "",
    reason: "",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState<string | null>(null);

  const effectiveCustomerId = lockedCustomerId ?? form.customerId;
  const availableSales = useMemo(() => {
    if (!effectiveCustomerId) {
      return salesOptions;
    }

    return salesOptions.filter((sale) => sale.customerId === effectiveCustomerId);
  }, [effectiveCustomerId, salesOptions]);

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const created = await clientApiRequest<CrmQueueItem>("/crm/tasks", {
        method: "POST",
        body: JSON.stringify({
          customerId: lockedCustomerId ?? form.customerId,
          salesOrderId: form.salesOrderId || null,
          taskType: form.taskType,
          priority: form.priority,
          dueAt: form.dueAt || null,
          reason: form.reason,
          notes: form.notes || null,
        }),
      });

      setItems((current) => [created, ...current]);
      setDrafts((current) => ({
        ...current,
        [created.id]: {
          taskStatus: created.taskStatus,
          notes: created.notes ?? "",
        },
      }));
      setForm({
        customerId: lockedCustomerId ?? "",
        salesOrderId: "",
        taskType: "manual_action_due",
        priority: "medium",
        dueAt: "",
        reason: "",
        notes: "",
      });
      setMessage("Ação CRM registrada com sucesso.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível registrar a ação CRM.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateTask(taskId: string) {
    const draft = drafts[taskId];

    if (!draft) {
      return;
    }

    setTaskUpdatingId(taskId);
    setMessage(null);
    setError(null);

    try {
      const updated = await clientApiRequest<CrmQueueItem>(`/crm/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          taskStatus: draft.taskStatus,
          notes: draft.notes || null,
        }),
      });

      setItems((current) =>
        current.map((item) => (item.id === taskId ? updated : item)),
      );
      setDrafts((current) => ({
        ...current,
        [taskId]: {
          taskStatus: updated.taskStatus,
          notes: updated.notes ?? "",
        },
      }));
      setMessage("Tarefa atualizada com sucesso.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível atualizar a tarefa CRM.",
      );
    } finally {
      setTaskUpdatingId(null);
    }
  }

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-black/55">{emptyMessage}</p>
          ) : (
            items.map((item) => {
              const draft = drafts[item.id] ?? {
                taskStatus: item.taskStatus,
                notes: item.notes ?? "",
              };

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-black/5 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={
                            TASK_TYPE_OPTIONS.find(
                              (option) => option.value === item.taskType,
                            )?.label ?? item.taskType
                          }
                          tone={item.isOverdue ? "high" : PRIORITY_TONES[item.priority]}
                        />
                        <StatusBadge
                          label={STATUS_LABELS[item.taskStatus]}
                          tone={STATUS_TONES[item.taskStatus]}
                        />
                        <StatusBadge
                          label={`Prioridade ${item.priority === "high" ? "alta" : item.priority === "medium" ? "média" : "baixa"}`}
                          tone={PRIORITY_TONES[item.priority]}
                        />
                      </div>

                      <p className="text-base font-semibold text-grafite">
                        <Link
                          className="hover:text-vinho-900 hover:underline"
                          href={`/customers/${item.customerId}`}
                        >
                          {item.customerName}
                        </Link>
                      </p>

                      <p className="text-sm text-black/65">{item.reason}</p>

                      <div className="flex flex-wrap gap-4 text-xs text-black/45">
                        <span>Vence: {formatDateTime(item.dueAt)}</span>
                        <span>Responsável: {item.ownerUserName ?? "Não atribuído"}</span>
                        <span>Atualizado: {formatDateTime(item.updatedAt)}</span>
                        {item.saleNumber ? <span>Pedido: {item.saleNumber}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_140px]">
                    <select
                      className="input-soft"
                      value={draft.taskStatus}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            ...draft,
                            taskStatus: event.target.value as CustomerInteractionStatus,
                          },
                        }))
                      }
                    >
                      {getStatusOptions(item.taskType).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>

                    <textarea
                      className="input-soft min-h-20 w-full"
                      placeholder="Registrar retorno, objeção, contexto ou decisão operacional."
                      value={draft.notes}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: {
                            ...draft,
                            notes: event.target.value,
                          },
                        }))
                      }
                    />

                    <button
                      className="btn-primary"
                      disabled={taskUpdatingId === item.id}
                      onClick={() => handleUpdateTask(item.id)}
                      type="button"
                    >
                      {taskUpdatingId === item.id ? "Salvando..." : "Atualizar"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form className="space-y-4" onSubmit={handleCreateTask}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Cliente
            </label>
            {lockedCustomerId ? (
              <div className="input-soft flex min-h-11 items-center">
                {lockedCustomerLabel ?? "Cliente fixo"}
              </div>
            ) : (
              <select
                className="input-soft w-full"
                disabled={customerOptions.length === 0}
                value={form.customerId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    customerId: event.target.value,
                    salesOrderId: "",
                  }))
                }
              >
                <option value="">Selecione um cliente</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Tipo de ação
            </label>
            <select
              className="input-soft w-full"
              value={form.taskType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  taskType: event.target.value as CustomerInteractionType,
                }))
              }
            >
              {TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Pedido vinculado
            </label>
            <select
              className="input-soft w-full"
              value={form.salesOrderId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  salesOrderId: event.target.value,
                }))
              }
            >
              <option value="">Sem vínculo direto</option>
              {availableSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.saleNumber} · {sale.customerName ?? "Sem cliente"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Prioridade
            </label>
            <select
              className="input-soft w-full"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value as CustomerInteractionPriority,
                }))
              }
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Vencimento
            </label>
            <input
              className="input-soft w-full"
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dueAt: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Motivo da ação
            </label>
            <textarea
              className="input-soft min-h-24 w-full"
              placeholder="Explique o motivo operacional da ação."
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Nota livre
            </label>
            <textarea
              className="input-soft min-h-20 w-full"
              placeholder="Contexto adicional, retorno do cliente ou instrução de atendimento."
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </div>

          {customerOptions.length === 0 && !lockedCustomerId ? (
            <p className="text-sm text-black/55">
              Nenhum cliente ativo disponível no momento. O formulário será liberado assim
              que a base comercial tiver clientes reconciliados.
            </p>
          ) : null}

          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={isSubmitting || (!lockedCustomerId && customerOptions.length === 0)}
              type="submit"
            >
              {isSubmitting ? "Salvando..." : "Registrar ação"}
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
