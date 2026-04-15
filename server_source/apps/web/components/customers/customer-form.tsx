"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { clientApiRequest } from "@/lib/client-api";
import type { ChannelOption, CustomerListItem, CustomerStatus } from "@/types";

type CustomerFormProps = {
  mode: "create" | "edit";
  channels: ChannelOption[];
  customer?: CustomerListItem;
};

const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: "Lead",
  novo: "Novo",
  recorrente: "Recorrente",
  inativo: "Inativo",
};

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

function statusLabel(status: CustomerStatus) {
  return CUSTOMER_STATUS_LABELS[status] ?? status;
}

export function CustomerForm({
  mode,
  channels,
  customer,
}: CustomerFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: customer?.fullName ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    acquisitionChannelId: customer?.acquisitionChannelId ?? "",
    notes: customer?.notes ?? "",
    isActive: customer?.isActive ?? true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function updateField<Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const semanticStatus: CustomerStatus = customer?.customerStatus ?? "lead";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    const payload = {
      fullName: form.fullName,
      phone: form.phone || null,
      email: form.email || null,
      acquisitionChannelId: form.acquisitionChannelId || null,
      notes: form.notes || null,
      isActive: form.isActive,
    };

    try {
      if (mode === "create") {
        const created = await clientApiRequest<CustomerListItem>("/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        router.push(`/customers/${created.id}`);
        return;
      }

      const updated = await clientApiRequest<CustomerListItem>(
        `/customers/${customer?.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      setForm({
        fullName: updated.fullName,
        phone: updated.phone ?? "",
        email: updated.email ?? "",
        acquisitionChannelId: updated.acquisitionChannelId ?? "",
        notes: updated.notes ?? "",
        isActive: updated.isActive,
      });
      setMessage("Cliente atualizado com sucesso.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível salvar o cliente.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const pageTitle = mode === "create" ? "Novo cliente" : "Detalhe do cliente";
  const pageDescription =
    mode === "create"
      ? "Cadastre o cliente com origem e dados operacionais básicos. O código interno é gerado automaticamente."
      : "Ajuste o cadastro operacional sem apagar fisicamente o cliente. O código interno permanece imutável.";

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>{pageTitle}</h1>
          <p className="mt-2 text-sm text-black/55">{pageDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/customers">
            Voltar para clientes
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title="Cadastro principal"
          subtitle="Nome, telefone e canal de aquisição pesquisáveis para o CRM operacional."
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Nome completo
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: Cliente Viníssimo"
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Código interno
                </label>
                <div className="input-soft flex min-h-11 items-center">
                  {customer?.customerCode ?? "Será gerado automaticamente ao salvar"}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Telefone
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: (62) 99999-0000"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Email
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: cliente@exemplo.com"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Canal de aquisição
                </label>
                <select
                  className="input-soft w-full"
                  value={form.acquisitionChannelId}
                  onChange={(event) =>
                    updateField("acquisitionChannelId", event.target.value)
                  }
                >
                  <option value="">Não informado</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.channelName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Ativo no SOI
                </label>
                <select
                  className="input-soft w-full"
                  value={form.isActive ? "true" : "false"}
                  onChange={(event) =>
                    updateField("isActive", event.target.value === "true")
                  }
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Observações operacionais
              </label>
              <textarea
                className="input-soft min-h-28 w-full"
                placeholder="Anotações úteis para o relacionamento e o atendimento."
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </div>

            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex justify-stretch sm:justify-end">
              <button className="btn-primary w-full sm:w-auto" disabled={isPending} type="submit">
                {isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Criar cliente"
                    : "Salvar alterações"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Leitura operacional"
          subtitle="Status do cliente, atividade do cadastro e métricas atuais disponíveis no SOI."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={statusLabel(semanticStatus)}
                tone={semanticStatus}
              />
              <StatusBadge
                label={form.isActive ? "Cadastro ativo" : "Cadastro inativo"}
                tone={form.isActive ? "success" : "inativo"}
              />
            </div>

            <p className="text-sm text-black/55">
              O status do cliente é calculado automaticamente pelo histórico de compras entregues.
              O código operacional do cliente segue o padrão <strong>CLI-000001</strong> e
              é criado automaticamente. Sem compras entregues, o status permanece como{" "}
              <strong>lead</strong>.
            </p>

            {customer ? (
              <div className="space-y-3 text-sm text-black/65">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Primeira compra
                  </p>
                  <p>{formatDateTime(customer.firstPurchaseAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Última compra
                  </p>
                  <p>{formatDateTime(customer.lastPurchaseAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Pedidos
                  </p>
                  <p>{customer.ordersCount}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Receita total
                  </p>
                  <p>{formatCurrency(customer.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Ticket médio
                  </p>
                  <p>{formatCurrency(customer.avgTicket)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                    Métrica calculada em
                  </p>
                  <p>{formatDateTime(customer.calculatedAt)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-black/55">
                As métricas começam com zero ou nulo até existirem compras reais.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
