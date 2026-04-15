"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { clientApiRequest } from "@/lib/client-api";
import type { CustomerPreference } from "@/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CustomerPreferencesForm({
  customerId,
  preferences,
}: {
  customerId: string;
  preferences: CustomerPreference[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    preferenceType: "",
    preferenceValue: "",
    source: "",
  });
  const [items, setItems] = useState(preferences);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      const created = await clientApiRequest<CustomerPreference>(
        `/customers/${customerId}/preferences`,
        {
          method: "POST",
          body: JSON.stringify({
            preferenceType: form.preferenceType,
            preferenceValue: form.preferenceValue,
            source: form.source || null,
          }),
        },
      );

      setItems((current) => [created, ...current]);
      setForm({
        preferenceType: "",
        preferenceValue: "",
        source: "",
      });
      setMessage("Preferência registrada com sucesso.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível registrar a preferência.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <SectionCard
      title="Preferências operacionais"
      subtitle="Registre gostos, restrições e sinais úteis para o atendimento consultivo."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-black/55">
              Nenhuma preferência registrada até o momento.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-grafite">
                    {item.preferenceType}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-black/45">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-black/70">{item.preferenceValue}</p>
                <p className="mt-2 text-xs text-black/45">
                  Origem: {item.source ?? "Não informada"}
                </p>
              </div>
            ))
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Tipo de preferência
            </label>
            <input
              className="input-soft w-full"
              placeholder="Ex.: Estilo favorito"
              value={form.preferenceType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferenceType: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Valor
            </label>
            <textarea
              className="input-soft min-h-24 w-full"
              placeholder="Ex.: Prefere tintos estruturados e evita vinhos muito doces."
              value={form.preferenceValue}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferenceValue: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Fonte
            </label>
            <input
              className="input-soft w-full"
              placeholder="Ex.: Atendimento em loja"
              value={form.source}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
            />
          </div>

          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={isPending} type="submit">
              {isPending ? "Salvando..." : "Adicionar preferência"}
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
