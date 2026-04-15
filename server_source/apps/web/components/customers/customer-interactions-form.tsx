"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { clientApiRequest } from "@/lib/client-api";
import type { CustomerInteraction, CustomerInteractionType } from "@/types";

const INTERACTION_OPTIONS: Array<{
  value: CustomerInteractionType;
  label: string;
}> = [
  { value: "post_sale", label: "Pós-venda" },
  { value: "review_request", label: "Pedido de avaliação" },
  { value: "reactivation", label: "Reativação" },
  { value: "other", label: "Outro" },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CustomerInteractionsForm({
  customerId,
  interactions,
}: {
  customerId: string;
  interactions: CustomerInteraction[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    interactionType: "post_sale" as CustomerInteractionType,
    scheduledFor: "",
    completedAt: "",
    notes: "",
  });
  const [items, setItems] = useState(interactions);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      const created = await clientApiRequest<CustomerInteraction>(
        `/customers/${customerId}/interactions`,
        {
          method: "POST",
          body: JSON.stringify({
            interactionType: form.interactionType,
            scheduledFor: form.scheduledFor || null,
            completedAt: form.completedAt || null,
            notes: form.notes || null,
          }),
        },
      );

      setItems((current) => [created, ...current]);
      setForm({
        interactionType: "post_sale",
        scheduledFor: "",
        completedAt: "",
        notes: "",
      });
      setMessage("Interação registrada com sucesso.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível registrar a interação.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <SectionCard
      title="Interações operacionais"
      subtitle="Registre contato agendado, retorno concluído e anotações do relacionamento."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-black/55">
              Nenhuma interação registrada até o momento.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-grafite">
                    {INTERACTION_OPTIONS.find(
                      (option) => option.value === item.interactionType,
                    )?.label ?? item.interactionType}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-black/45">
                    Criado em {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-black/70 md:grid-cols-2">
                  <p>Agendado: {formatDateTime(item.scheduledFor)}</p>
                  <p>Concluído: {formatDateTime(item.completedAt)}</p>
                </div>
                <p className="mt-2 text-sm text-black/70">{item.notes ?? "Sem notas."}</p>
                <p className="mt-2 text-xs text-black/45">
                  Responsável: {item.ownerUserName ?? "Não informado"}
                </p>
              </div>
            ))
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Tipo de interação
            </label>
            <select
              className="input-soft w-full"
              value={form.interactionType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  interactionType: event.target.value as CustomerInteractionType,
                }))
              }
            >
              {INTERACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Agendado para
            </label>
            <input
              className="input-soft w-full"
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scheduledFor: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Concluído em
            </label>
            <input
              className="input-soft w-full"
              type="datetime-local"
              value={form.completedAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  completedAt: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Notas
            </label>
            <textarea
              className="input-soft min-h-24 w-full"
              placeholder="Ex.: Cliente pediu curadoria focada em tintos de médio corpo."
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </div>

          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={isPending} type="submit">
              {isPending ? "Salvando..." : "Adicionar interação"}
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
