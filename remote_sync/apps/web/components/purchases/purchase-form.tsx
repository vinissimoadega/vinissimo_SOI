"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { clientApiRequest } from "@/lib/client-api";
import { lookupProductBySku } from "@/lib/product-sku-lookup";
import { BarcodeScannerSheet } from "@/components/scanner/barcode-scanner-sheet";
import type {
  PurchaseDetail,
  PurchaseProductOption,
  PurchaseSupplierOption,
  ProductSkuLookupItem,
} from "@/types";

type PurchaseFormProps = {
  mode: "create" | "edit";
  suppliers: PurchaseSupplierOption[];
  products: PurchaseProductOption[];
  purchase?: PurchaseDetail;
};

type ItemDraft = {
  rowId: string;
  productId: string;
  quantity: string;
  unitCost: string;
  freightAllocated: string;
  extraCostAllocated: string;
};

function formatCurrency(value: string | null) {
  if (!value) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildItemDraft(products: PurchaseProductOption[]): ItemDraft {
  const firstProduct = products[0];

  return {
    rowId: crypto.randomUUID(),
    productId: firstProduct?.id ?? "",
    quantity: "1.00",
    unitCost:
      firstProduct?.currentUnitCost ??
      firstProduct?.baseUnitCost ??
      "0.00",
    freightAllocated: "0.00",
    extraCostAllocated: "0.00",
  };
}

function calculateItemSummary(item: ItemDraft) {
  const quantity = Number(item.quantity || 0);
  const unitCost = Number(item.unitCost || 0);
  const freightAllocated = Number(item.freightAllocated || 0);
  const extraCostAllocated = Number(item.extraCostAllocated || 0);
  const totalCost = unitCost * quantity + freightAllocated + extraCostAllocated;
  const realUnitCost = quantity > 0 ? totalCost / quantity : 0;

  return {
    totalCost: totalCost.toFixed(2),
    realUnitCost: realUnitCost.toFixed(2),
  };
}

export function PurchaseForm({
  mode,
  suppliers,
  products,
  purchase,
}: PurchaseFormProps) {
  const router = useRouter();
  const [availableProducts, setAvailableProducts] = useState(products);
  const [form, setForm] = useState({
    purchaseNumber: purchase?.purchaseNumber ?? "",
    supplierId: purchase?.supplierId ?? "",
    purchaseDate:
      purchase?.purchaseDate?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    notes: purchase?.notes ?? "",
  });
  const [items, setItems] = useState<ItemDraft[]>(
    mode === "create"
      ? [buildItemDraft(availableProducts), buildItemDraft(availableProducts)]
      : [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerRowId, setScannerRowId] = useState<string | null>(null);
  const [scannerActionHref, setScannerActionHref] = useState<string | null>(null);

  const totalPreview = useMemo(
    () =>
      items
        .reduce((sum, item) => sum + Number(calculateItemSummary(item).totalCost), 0)
        .toFixed(2),
    [items],
  );

  function updateField<Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateItem(
    rowId: string,
    field: keyof ItemDraft,
    value: string,
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.rowId !== rowId) {
          return item;
        }

        const nextItem = {
          ...item,
          [field]: value,
        };

        if (field === "productId") {
          const selectedProduct = availableProducts.find(
            (product) => product.id === value,
          );

          if (selectedProduct) {
            nextItem.unitCost =
              item.unitCost.trim() === "" || item.unitCost === "0.00"
                ? selectedProduct.currentUnitCost ??
                  selectedProduct.baseUnitCost ??
                  item.unitCost
                : item.unitCost;
          }
        }

        return nextItem;
      }),
    );
  }

  function addItem() {
    setItems((current) => [...current, buildItemDraft(availableProducts)]);
  }

  function removeItem(rowId: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.rowId !== rowId) : current,
    );
  }

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
          currentUnitCost: product.currentUnitCost,
          baseUnitCost: product.currentUnitCost,
          isActive: product.isActive,
        },
        ...current,
      ];
    });
  }

  async function handleDetectedSku(sku: string) {
    setMessage(null);
    setError(null);
    setScannerActionHref(null);

    const targetRowId = scannerRowId;

    if (!targetRowId) {
      setError("Escolha a linha da compra antes de usar a câmera.");
      return;
    }

    const lookup = await lookupProductBySku(sku);

    if (!lookup.found || !lookup.product) {
      setError(
        `O SKU ${lookup.sku} ainda não está cadastrado. Cadastre o produto e volte para esta compra.`,
      );
      setScannerActionHref(`/products/new?sku=${encodeURIComponent(lookup.sku)}`);
      return;
    }

    ensureProductOption(lookup.product);
    setItems((current) =>
      current.map((item) => {
        if (item.rowId !== targetRowId) {
          return item;
        }

        return {
          ...item,
          productId: lookup.product!.id,
          unitCost:
            item.unitCost.trim() === "" || item.unitCost === "0.00"
              ? lookup.product!.currentUnitCost ?? "0.00"
              : item.unitCost,
        };
      }),
    );
    setMessage(
      `Produto localizado pela câmera: ${lookup.product.sku} · ${lookup.product.name}. A linha da compra foi preenchida automaticamente.`,
    );
    setScannerActionHref(`/products/${lookup.product.id}`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      if (mode === "create") {
        const payload = {
          purchaseNumber: form.purchaseNumber,
          supplierId: form.supplierId || null,
          purchaseDate: form.purchaseDate,
          notes: form.notes || null,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            freightAllocated: item.freightAllocated || "0.00",
            extraCostAllocated: item.extraCostAllocated || "0.00",
          })),
        };

        const created = await clientApiRequest<PurchaseDetail>("/purchases", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        router.push(`/purchases/${created.id}`);
        return;
      }

      const updated = await clientApiRequest<PurchaseDetail>(
        `/purchases/${purchase?.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            purchaseNumber: form.purchaseNumber,
            supplierId: form.supplierId || null,
            notes: form.notes || null,
          }),
        },
      );

      setForm({
        purchaseNumber: updated.purchaseNumber,
        supplierId: updated.supplierId ?? "",
        purchaseDate: updated.purchaseDate.slice(0, 10),
        notes: updated.notes ?? "",
      });
      setMessage("Cabeçalho da compra atualizado.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível salvar a compra.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const pageTitle = mode === "create" ? "Nova compra" : "Detalhe da compra";
  const pageDescription =
    mode === "create"
      ? "Registre uma entrada com múltiplos itens, custo real por linha e impacto operacional no estoque."
      : "Edição restrita ao cabeçalho. Itens, movimentos e custo operacional permanecem auditáveis após a gravação.";

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>{pageTitle}</h1>
          <p className="mt-2 text-sm text-black/55">{pageDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/purchases">
            Voltar para compras
          </Link>
        </div>
      </header>

      <div className="space-y-6">
        <SectionCard
          title="Cabeçalho"
          subtitle="Número da compra, fornecedor opcional e data operacional da entrada."
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Número da compra
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: CMP-2026-001"
                  value={form.purchaseNumber}
                  onChange={(event) =>
                    updateField("purchaseNumber", event.target.value.toUpperCase())
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Fornecedor
                </label>
                <select
                  className="input-soft w-full"
                  value={form.supplierId}
                  onChange={(event) => updateField("supplierId", event.target.value)}
                >
                  <option value="">Não informado</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Data da compra
                </label>
                <input
                  className="input-soft w-full"
                  type="date"
                  value={form.purchaseDate}
                  disabled={mode === "edit"}
                  onChange={(event) => updateField("purchaseDate", event.target.value)}
                />
                {mode === "edit" ? (
                  <p className="mt-1 text-xs text-black/45">
                    A data fica travada após a gravação para preservar a ordem dos movimentos e snapshots.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Observações
              </label>
              <textarea
                className="input-soft min-h-28 w-full"
                placeholder="Notas de recebimento, divergências ou detalhes fiscais."
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </div>

            {mode === "create" ? (
              <div className="space-y-4">
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-grafite">Itens da compra</h3>
                    <p className="text-xs text-black/45">
                      Cada linha calcula custo total e custo unitário real.
                    </p>
                  </div>
                  <button
                    className="btn-secondary w-full sm:w-auto"
                    onClick={addItem}
                    type="button"
                  >
                    Adicionar item
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => {
                    const summary = calculateItemSummary(item);

                    return (
                      <div
                        key={item.rowId}
                        className="rounded-3xl border border-black/5 bg-vinho-50 px-4 py-4"
                      >
                        <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                          <div>
                            <p className="text-sm font-semibold text-grafite">
                              Item {index + 1}
                            </p>
                            <p className="text-xs text-black/45">
                              Total {formatCurrency(summary.totalCost)} · Custo real/unit {formatCurrency(summary.realUnitCost)}
                            </p>
                          </div>
                          <button
                            className="btn-secondary h-11 w-full px-3 sm:h-9 sm:w-auto"
                            disabled={items.length <= 1}
                            onClick={() => removeItem(item.rowId)}
                            type="button"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                          <div className="xl:col-span-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                              Produto
                            </label>
                            <select
                              className="input-soft w-full"
                              value={item.productId}
                              onChange={(event) =>
                                updateItem(item.rowId, "productId", event.target.value)
                              }
                            >
                              <option value="">Selecione um produto</option>
                              {availableProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.sku} · {product.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn-secondary mt-2 w-full sm:w-auto"
                              onClick={() => {
                                setScannerRowId(item.rowId);
                                setIsScannerOpen(true);
                              }}
                              type="button"
                            >
                              Ler código pela câmera
                            </button>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                              Quantidade
                            </label>
                            <input
                              className="input-soft w-full"
                              inputMode="decimal"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.rowId, "quantity", event.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                              Custo unitário
                            </label>
                            <input
                              className="input-soft w-full"
                              inputMode="decimal"
                              value={item.unitCost}
                              onChange={(event) =>
                                updateItem(item.rowId, "unitCost", event.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                              Frete rateado
                            </label>
                            <input
                              className="input-soft w-full"
                              inputMode="decimal"
                              value={item.freightAllocated}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "freightAllocated",
                                  event.target.value,
                                )
                              }
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                              Custo extra rateado
                            </label>
                            <input
                              className="input-soft w-full"
                              inputMode="decimal"
                              value={item.extraCostAllocated}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "extraCostAllocated",
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={`${items.length} item(ns)`}
                    tone="warning"
                  />
                  <StatusBadge
                    label={`Total previsto ${formatCurrency(totalPreview)}`}
                    tone="success"
                  />
                </div>
              </div>
            ) : purchase ? (
              <SectionCard
                title="Itens gravados"
                subtitle="Itens, movimentos e custo operacional ficam congelados depois da compra."
              >
                <div className="space-y-3">
                  {purchase.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-black/5 bg-vinho-50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-grafite">
                            {item.productSku} · {item.productName}
                          </p>
                          <p className="text-xs text-black/45">
                            {item.quantity} un · custo real/unit {formatCurrency(item.realUnitCost)}
                          </p>
                        </div>
                        <StatusBadge
                          label={formatCurrency(item.totalCost)}
                          tone="success"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {scannerActionHref ? (
              <div className="flex">
                <Link className="btn-secondary w-full sm:w-auto" href={scannerActionHref}>
                  {scannerActionHref.startsWith("/products/new")
                    ? "Cadastrar produto com este SKU"
                    : "Abrir produto encontrado"}
                </Link>
              </div>
            ) : null}

            <div className="flex justify-stretch sm:justify-end">
              <button className="btn-primary w-full sm:w-auto" disabled={isPending} type="submit">
                {isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Registrar compra"
                    : "Salvar cabeçalho"}
              </button>
            </div>
          </form>
        </SectionCard>

        {purchase ? (
          <SectionCard
            title="Leitura operacional"
            subtitle="Resumo auditável da entrada gravada."
          >
            <div className="space-y-3 text-sm text-black/65">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Total da compra
                </p>
                <p>{formatCurrency(purchase.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Itens lançados
                </p>
                <p>{purchase.itemsCount}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Fornecedor
                </p>
                <p>{purchase.supplierName ?? "Não informado"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Data operacional
                </p>
                <p>{formatDateTime(purchase.purchaseDate)}</p>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>

      <BarcodeScannerSheet
        description="Aponte a câmera para o código de barras do item da compra. Se o SKU existir, o produto entra direto na linha da compra."
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={async ({ sku }) => {
          await handleDetectedSku(sku);
        }}
        title="Ler código pela câmera"
      />
    </div>
  );
}
