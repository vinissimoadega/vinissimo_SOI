"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApiRequest } from "@/lib/client-api";
import { lookupProductBySku } from "@/lib/product-sku-lookup";
import { BarcodeScannerSheet } from "@/components/scanner/barcode-scanner-sheet";
import type {
  InventoryMovementItem,
  InventoryProductOption,
  ProductSkuLookupItem,
} from "@/types";

type InventoryAdjustmentFormProps = {
  products: InventoryProductOption[];
  initialProductId?: string;
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
  initialProductId,
}: InventoryAdjustmentFormProps) {
  const router = useRouter();
  const [availableProducts, setAvailableProducts] = useState(products);
  const initialProduct =
    availableProducts.find((product) => product.id === initialProductId) ??
    availableProducts[0];
  const [form, setForm] = useState({
    productId: initialProduct?.id ?? "",
    movementDate: new Date().toISOString().slice(0, 10),
    adjustmentMode: "delta_manual" as AdjustmentMode,
    quantityDelta: "1.00",
    targetStockQty: initialProduct?.currentStockQty ?? "0.00",
    notes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerActionHref, setScannerActionHref] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () =>
      availableProducts.find((product) => product.id === form.productId) ??
      availableProducts[0],
    [availableProducts, form.productId],
  );
  const currentStockQty = Number(selectedProduct?.currentStockQty ?? 0);
  const targetStockQty = Number(form.targetStockQty || 0);
  const previewDelta =
    form.adjustmentMode === "target_balance"
      ? (targetStockQty - currentStockQty).toFixed(2)
      : (Number(form.quantityDelta || 0) || 0).toFixed(2);

  function ensureProductOption(product: ProductSkuLookupItem) {
    setAvailableProducts((current) => {
      if (current.some((item) => item.id === product.id)) {
        return current;
      }

      return [
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          isActive: product.isActive,
          currentUnitCost: product.currentUnitCost ?? "0.00",
          currentStockQty: product.currentStockQty,
        },
        ...current,
      ];
    });
  }

  async function handleDetectedSku(sku: string) {
    setMessage(null);
    setError(null);
    setScannerActionHref(null);

    const lookup = await lookupProductBySku(sku);

    if (!lookup.found || !lookup.product) {
      setError(
        `O SKU ${lookup.sku} ainda não está cadastrado. Cadastre o produto antes de ajustar o saldo real.`,
      );
      setScannerActionHref(`/products/new?sku=${encodeURIComponent(lookup.sku)}`);
      return;
    }

    ensureProductOption(lookup.product);
    setForm((current) => ({
      ...current,
      productId: lookup.product!.id,
      targetStockQty: lookup.product!.currentStockQty ?? "0.00",
    }));
    setMessage(
      `Produto localizado pela câmera: ${lookup.product.sku} · ${lookup.product.name}. Agora você pode corrigir o saldo real.`,
    );
    setScannerActionHref(`/products/${lookup.product.id}`);
  }

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
      {selectedProduct ? (
        <div className="rounded-2xl border border-black/10 bg-vinho-50 px-4 py-3 text-sm text-black/60">
          <p className="font-semibold text-vinho-950">
            Produto selecionado para correção: {selectedProduct.sku} · {selectedProduct.name}
          </p>
          <p className="mt-1">
            Use <strong>Saldo real contado</strong> para alinhar o sistema ao físico e
            <strong> Delta manual</strong> apenas quando você souber exatamente o impacto a aplicar.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <button
          className="btn-secondary lg:col-span-2"
          onClick={() => setIsScannerOpen(true)}
          type="button"
        >
          Ler código pela câmera
        </button>

        <select
          className="input-soft"
          value={form.productId}
          onChange={(event) => {
            const nextProduct = availableProducts.find(
              (product) => product.id === event.target.value,
            );

            setForm((current) => ({
              ...current,
              productId: event.target.value,
              targetStockQty: nextProduct?.currentStockQty ?? "0.00",
            }));
          }}
        >
          {availableProducts.map((product) => (
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

        <div className="input-soft flex min-h-11 items-center bg-black/[0.02] lg:col-span-2">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button className="btn-primary w-full sm:w-auto" disabled={isPending} type="submit">
          {isPending ? "Salvando..." : "Registrar ajuste"}
        </button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {scannerActionHref ? (
          <Link className="btn-secondary w-full sm:w-auto" href={scannerActionHref}>
            {scannerActionHref.startsWith("/products/new")
              ? "Cadastrar produto com este SKU"
              : "Abrir produto encontrado"}
          </Link>
        ) : null}
      </div>

      <BarcodeScannerSheet
        description="Aponte a câmera para o código de barras do produto. Se o SKU já existir, o produto será selecionado automaticamente para o ajuste."
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={async ({ sku }) => {
          await handleDetectedSku(sku);
        }}
        title="Ler código pela câmera"
      />
    </form>
  );
}
