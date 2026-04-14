"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApiRequest } from "@/lib/client-api";
import type { InventoryMovementItem, InventoryProductOption } from "@/types";

type InventoryAdjustmentFormProps = {
  products: InventoryProductOption[];
};

type AdjustmentMode = "delta_manual" | "target_balance";

function formatDecimal(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function InventoryAdjustmentForm({
  products,
}: InventoryAdjustmentFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    movementDate: new Date().toISOString().slice(0, 10),
    adjustmentMode: "delta_manual" as AdjustmentMode,
    quantityDelta: "1.00",
    targetStockQty: products[0]?.currentStockQty ?? "0.00",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) ?? products[0],
    [form.productId, products],
  );
  const currentStockQty = Number(selectedProduct?.currentStockQty ?? 0);
  const targetStockQty = Number(form.targetStockQty || 0);
  const previewDelta =
    form.adjustmentMode === "target_balance"
      ? (targetStockQty - currentStockQty).toFixed(2)
      : (Number(form.quantityDelta || 0) || 0).toFixed(2);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      const created = await clientApiRequest<InventoryMovementItem>(
        "/inventory/movements",
        {
          method: "POST",
          body: JSON.stringify({
            productId: form.productId,
            movementDate: form.movementDate,
            adjustmentMode: form.adjustmentMode,
            quantityDelta:
              form.adjustmentMode === "delta_manual" ? form.quantityDelta : undefined,
            targetStockQty:
              form.adjustmentMode === "target_balance"
                ? form.targetStockQty
                : undefined,
            notes: form.notes,
          }),
        },
      );

      setMessage(
        `Ajuste registrado para ${created.productSku} com impacto ${created.quantityDelta}.`,
      );
      setForm((current) => ({
        ...current,
        quantityDelta: "1.00",
        targetStockQty: selectedProduct?.currentStockQty ?? "0.00",
        notes: "",
      }));
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível registrar o ajuste manual.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-5">
        <select
          className="input-soft"
          value={form.productId}
          onChange={(event) => {
            const nextProduct = products.find(
              (product) => product.id === event.target.value,
            );

            setForm((current) => ({
              ...current,
              productId: event.target.value,
              targetStockQty: nextProduct?.currentStockQty ?? "0.00",
            }));
          }}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.sku} · {product.name}
            </option>
          ))}
        </select>

        <input
          className="input-soft"
          type="date"
          value={form.movementDate}
          onChange={(event) =>
            setForm((current) => ({ ...current, movementDate: event.target.value }))
          }
        />

        <select
          className="input-soft"
          value={form.adjustmentMode}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              adjustmentMode: event.target.value as AdjustmentMode,
            }))
          }
        >
          <option value="delta_manual">Delta manual</option>
          <option value="target_balance">Saldo real contado</option>
        </select>

        <div className="input-soft flex min-h-11 items-center bg-black/[0.02]">
          Saldo atual: {formatDecimal(selectedProduct?.currentStockQty ?? "0.00")}
        </div>

        <div className="input-soft flex min-h-11 items-center bg-black/[0.02]">
          Custo ref.: {formatDecimal(selectedProduct?.currentUnitCost ?? "0.00")}
        </div>

        {form.adjustmentMode === "delta_manual" ? (
          <input
            className="input-soft"
            placeholder="Ex.: -2.00 ou 3.00"
            step="0.01"
            value={form.quantityDelta}
            onChange={(event) =>
              setForm((current) => ({ ...current, quantityDelta: event.target.value }))
            }
          />
        ) : (
          <input
            className="input-soft"
            inputMode="decimal"
            placeholder="Saldo físico contado"
            value={form.targetStockQty}
            onChange={(event) =>
              setForm((current) => ({ ...current, targetStockQty: event.target.value }))
            }
          />
        )}

        <div className="input-soft flex min-h-11 items-center bg-black/[0.02] md:col-span-2">
          {form.adjustmentMode === "delta_manual"
            ? `Delta informado: ${formatDecimal(previewDelta)}`
            : `Saldo contado: ${formatDecimal(form.targetStockQty || "0")} · Delta calculado: ${formatDecimal(previewDelta)}`}
        </div>

        <input
          className="input-soft md:col-span-2"
          placeholder="Motivo operacional obrigatório do ajuste manual"
          value={form.notes}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </div>

      <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.03] px-4 py-3 text-sm text-black/55">
        {form.adjustmentMode === "delta_manual"
          ? "Use delta manual quando souber exatamente o impacto a aplicar. Valores negativos retiram saldo e positivos adicionam saldo."
          : "Use saldo real contado para ajustar o sistema ao estoque físico. Pode informar 0.00 para zerar o produto quando o físico estiver zerado."}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={isPending} type="submit">
          {isPending ? "Salvando..." : "Registrar ajuste"}
        </button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}
