"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductChannelPrice } from "@/types";
import { clientApiRequest } from "@/lib/client-api";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

type PriceDraft = {
  channelId: string;
  channelKey: string;
  channelName: string;
  isActive: boolean;
  targetPrice: string;
};

export function ChannelPricesForm({
  productId,
  prices,
}: {
  productId: string;
  prices: ProductChannelPrice[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [drafts, setDrafts] = useState<PriceDraft[]>(
    prices.map((price) => ({
      channelId: price.channelId,
      channelKey: price.channelKey,
      channelName: price.channelName,
      isActive: price.isActive,
      targetPrice: price.targetPrice ?? "",
    })),
  );

  function updateDraft(channelId: string, value: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.channelId === channelId ? { ...draft, targetPrice: value } : draft,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await clientApiRequest<{
        productId: string;
        prices: ProductChannelPrice[];
      }>(`/products/${productId}/channel-prices`, {
        method: "PUT",
        body: JSON.stringify({
          prices: drafts.map((draft) => ({
            channelId: draft.channelId,
            targetPrice: draft.targetPrice.trim() === "" ? null : draft.targetPrice,
          })),
        }),
      });

      setDrafts(
        response.prices.map((price) => ({
          channelId: price.channelId,
          channelKey: price.channelKey,
          channelName: price.channelName,
          isActive: price.isActive,
          targetPrice: price.targetPrice ?? "",
        })),
      );
      setMessage("Preços por canal atualizados.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível atualizar os preços por canal.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <SectionCard
      title="Preços-alvo por canal"
      subtitle="Quando um canal tiver preço vazio, ele permanece opcional e não é gravado."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3">
          {drafts.map((draft) => (
            <div
              key={draft.channelId}
              className="grid gap-3 rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px]"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-grafite">{draft.channelName}</p>
                  <StatusBadge
                    label={draft.isActive ? "Canal ativo" : "Canal inativo"}
                    tone={draft.isActive ? "success" : "inativo"}
                  />
                </div>
                <p className="text-xs uppercase tracking-wide text-black/45">
                  {draft.channelKey}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Preço-alvo
                </label>
                <input
                  className="input-soft w-full"
                  inputMode="decimal"
                  placeholder="Ex.: 89.90"
                  value={draft.targetPrice}
                  onChange={(event) => updateDraft(draft.channelId, event.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div className="flex justify-end">
          <button className="btn-primary" disabled={isPending} type="submit">
            {isPending ? "Salvando..." : "Salvar preços por canal"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
