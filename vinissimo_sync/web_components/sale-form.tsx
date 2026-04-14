"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { clientApiRequest } from "@/lib/client-api";
import type {
  SaleChannelOption,
  SaleCustomerOption,
  SaleDetail,
  SaleItem,
  SaleOrderStatus,
  SalePaymentStatus,
  SaleProductOption,
} from "@/types";

type SaleFormProps = {
  mode: "create" | "edit";
  channels: SaleChannelOption[];
  customers: SaleCustomerOption[];
  products: SaleProductOption[];
  marginMinTarget: string;
  sale?: SaleDetail;
};

type ItemDraft = {
  rowId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
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

function formatPercent(value: string | null) {
  if (!value) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function buildItemDraft(products: SaleProductOption[]): ItemDraft {
  const firstProduct = products[0];

  return {
    rowId: crypto.randomUUID(),
    productId: firstProduct?.id ?? "",
    quantity: "1.00",
    unitPrice: firstProduct?.currentUnitCost ?? "0.00",
    discountAmount: "0.00",
  };
}

function getStatusUi(status: SaleOrderStatus) {
  switch (status) {
    case "delivered":
      return { label: "Entregue", tone: "success" as const };
    case "canceled":
      return { label: "Cancelado", tone: "high" as const };
    default:
      return { label: "Pendente", tone: "warning" as const };
  }
}

function getPaymentStatusLabel(status: SalePaymentStatus) {
  switch (status) {
    case "paid":
      return "Pago";
    case "pending_confirmation":
      return "Aguardando confirmação";
    case "failed":
      return "Falhou";
    case "refunded":
      return "Estornado";
    default:
      return "Não pago";
  }
}

function calculateItemSummary(
  item: ItemDraft,
  products: SaleProductOption[],
  channels: SaleChannelOption[],
  channelId: string,
  marginMinTarget: string,
) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const discountAmount = Number(item.discountAmount || 0);
  const selectedProduct = products.find((product) => product.id === item.productId);
  const selectedChannel = channels.find((channel) => channel.id === channelId);
  const costUnit = Number(selectedProduct?.currentUnitCost || 0);
  const channelFeePct = Number(selectedChannel?.feePct || 0);
  const grossRevenue = Math.max(unitPrice * quantity - discountAmount, 0);
  const netRevenue = grossRevenue * (1 - channelFeePct);
  const totalCost = costUnit * quantity;
  const grossProfit = netRevenue - totalCost;
  const grossMarginPct = netRevenue > 0 ? grossProfit / netRevenue : null;
  const denominator = 1 - channelFeePct - Number(marginMinTarget || 0);
  const minimumUnitPrice =
    quantity > 0 && denominator > 0 ? costUnit / denominator : null;
  const practicedUnitPrice = quantity > 0 ? grossRevenue / quantity : 0;

  return {
    grossRevenue: grossRevenue.toFixed(2),
    netRevenue: netRevenue.toFixed(2),
    totalCost: totalCost.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    grossMarginPct:
      grossMarginPct === null ? null : grossMarginPct.toFixed(4),
    costUnit: costUnit.toFixed(2),
    channelFeePct: channelFeePct.toFixed(4),
    minimumUnitPrice:
      minimumUnitPrice === null ? null : minimumUnitPrice.toFixed(2),
    belowMinPriceFlag:
      minimumUnitPrice === null ? false : practicedUnitPrice < minimumUnitPrice,
  };
}

function ReadOnlyItemRow({ item }: { item: SaleItem }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4 md:grid-cols-7">
      <div className="md:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Produto
        </p>
        <p className="mt-1 font-medium text-vinho-900">
          {item.productSku} · {item.productName}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Quantidade
        </p>
        <p className="mt-1">{item.quantity}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Receita líquida
        </p>
        <p className="mt-1">{formatCurrency(item.netRevenue)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Custo total
        </p>
        <p className="mt-1">{formatCurrency(item.totalCost)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Lucro
        </p>
        <p className="mt-1">{formatCurrency(item.grossProfit)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
          Sinalização
        </p>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge
            label={item.belowMinPriceFlag ? "Abaixo do mínimo" : "Preço ok"}
            tone={item.belowMinPriceFlag ? "warning" : "success"}
          />
        </div>
      </div>
    </div>
  );
}

export function SaleForm({
  mode,
  channels,
  customers,
  products,
  marginMinTarget,
  sale,
}: SaleFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    saleDate:
      sale?.saleDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    customerId: sale?.customerId ?? "",
    channelId: sale?.channelId ?? channels[0]?.id ?? "",
    orderStatus: sale?.orderStatus ?? ("pending" as SaleOrderStatus),
    paymentStatus: sale?.paymentStatus ?? ("unpaid" as SalePaymentStatus),
    externalChargeReference: sale?.externalChargeReference ?? "",
    paymentNotes: sale?.paymentNotes ?? "",
    notes: sale?.notes ?? "",
  });
  const [items, setItems] = useState<ItemDraft[]>(
    mode === "create" ? [buildItemDraft(products), buildItemDraft(products)] : [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const totalsPreview = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        const summary = calculateItemSummary(
          item,
          products,
          channels,
          form.channelId,
          marginMinTarget,
        );

        accumulator.grossRevenue += Number(summary.grossRevenue);
        accumulator.netRevenue += Number(summary.netRevenue);
        accumulator.totalCost += Number(summary.totalCost);
        accumulator.grossProfit += Number(summary.grossProfit);
        return accumulator;
      },
      {
        grossRevenue: 0,
        netRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
      },
    );
  }, [channels, form.channelId, items, marginMinTarget, products]);

  function updateField<Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateItem(rowId: string, field: keyof ItemDraft, value: string) {
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
          const selectedProduct = products.find((product) => product.id === value);

          if (selectedProduct) {
            nextItem.unitPrice =
              item.unitPrice.trim() === "" || item.unitPrice === "0.00"
                ? selectedProduct.currentUnitCost
                : item.unitPrice;
          }
        }

        return nextItem;
      }),
    );
  }

  function addItem() {
    setItems((current) => [...current, buildItemDraft(products)]);
  }

  function removeItem(rowId: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.rowId !== rowId) : current,
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      if (mode === "create") {
        const payload = {
          saleDate: form.saleDate,
          customerId: form.customerId || null,
          channelId: form.channelId,
          orderStatus: form.orderStatus,
          paymentStatus: form.paymentStatus,
          externalChargeReference: form.externalChargeReference || null,
          paymentNotes: form.paymentNotes || null,
          notes: form.notes || null,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount || "0.00",
          })),
        };

        const created = await clientApiRequest<SaleDetail>("/sales", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        router.push(`/sales/${created.id}`);
        return;
      }

      const updated = await clientApiRequest<SaleDetail>(`/sales/${sale?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          customerId: form.customerId || null,
          orderStatus: form.orderStatus,
          paymentStatus: form.paymentStatus,
          externalChargeReference: form.externalChargeReference || null,
          paymentNotes: form.paymentNotes || null,
          notes: form.notes || null,
        }),
      });

      setForm((current) => ({
        ...current,
        customerId: updated.customerId ?? "",
        orderStatus: updated.orderStatus,
        paymentStatus: updated.paymentStatus,
        externalChargeReference: updated.externalChargeReference ?? "",
        paymentNotes: updated.paymentNotes ?? "",
        notes: updated.notes ?? "",
      }));
      setMessage("Cabeçalho da venda atualizado.");
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível salvar a venda.",
      );
    } finally {
      setIsPending(false);
    }
  }

  const selectedChannel = channels.find((channel) => channel.id === form.channelId);
  const pageTitle = mode === "create" ? "Nova venda" : "Detalhe da venda";
  const pageDescription =
    mode === "create"
      ? "Registre um pedido com múltiplos itens, taxa por canal, custo corrente do produto e numeração automática."
      : "Edição restrita ao cabeçalho/status e pagamento. Itens, cálculos e movimentos permanecem auditáveis após a gravação.";
  const saleStatus = sale ? getStatusUi(sale.orderStatus) : null;

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1>{pageTitle}</h1>
            {saleStatus ? (
              <StatusBadge label={saleStatus.label} tone={saleStatus.tone} />
            ) : null}
          </div>
          <p className="mt-2 text-sm text-black/55">{pageDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/sales">
            Voltar para vendas
          </Link>
        </div>
      </header>

      <div className="space-y-6">
        <SectionCard
          title="Cabeçalho"
          subtitle="Canal, cliente opcional, data operacional, status do pedido e estado do pagamento."
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Número da venda
                </label>
                <div className="input-soft flex min-h-11 items-center">
                  {sale?.saleNumber ?? "Será gerado automaticamente ao salvar"}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Data da venda
                </label>
                <input
                  className="input-soft w-full"
                  disabled={mode === "edit"}
                  type="date"
                  value={form.saleDate}
                  onChange={(event) => updateField("saleDate", event.target.value)}
                />
                {mode === "edit" ? (
                  <p className="mt-1 text-xs text-black/45">
                    Data bloqueada após a gravação para preservar a auditoria operacional.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Canal
                </label>
                <select
                  className="input-soft w-full"
                  disabled={mode === "edit"}
                  value={form.channelId}
                  onChange={(event) => updateField("channelId", event.target.value)}
                >
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.channelName}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-black/45">
                  Taxa corrente do canal:{" "}
                  {selectedChannel
                    ? `${(Number(selectedChannel.feePct) * 100).toFixed(1)}%`
                    : "—"}{" "}
                  · margem mínima alvo: {(Number(marginMinTarget) * 100).toFixed(1)}%
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Cliente
                </label>
                <select
                  className="input-soft w-full"
                  value={form.customerId}
                  onChange={(event) => updateField("customerId", event.target.value)}
                >
                  <option value="">Venda sem cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Status
                </label>
                <select
                  className="input-soft w-full"
                  value={form.orderStatus}
                  onChange={(event) =>
                    updateField("orderStatus", event.target.value as SaleOrderStatus)
                  }
                >
                  <option value="pending">pending</option>
                  <option value="delivered">delivered</option>
                  <option value="canceled">canceled</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Pagamento
                </label>
                <select
                  className="input-soft w-full"
                  value={form.paymentStatus}
                  onChange={(event) =>
                    updateField("paymentStatus", event.target.value as SalePaymentStatus)
                  }
                >
                  <option value="unpaid">unpaid</option>
                  <option value="pending_confirmation">pending_confirmation</option>
                  <option value="paid">paid</option>
                  <option value="failed">failed</option>
                  <option value="refunded">refunded</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Referência externa
                </label>
                <input
                  className="input-soft w-full"
                  placeholder="Ex.: COB-2026-0001"
                  value={form.externalChargeReference}
                  onChange={(event) =>
                    updateField("externalChargeReference", event.target.value)
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Observações de cobrança
                </label>
                <textarea
                  className="input-soft min-h-24 w-full resize-y"
                  placeholder="Ex.: cobrança manual via WhatsApp, aguardando comprovante."
                  value={form.paymentNotes}
                  onChange={(event) => updateField("paymentNotes", event.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                  Observações
                </label>
                <textarea
                  className="input-soft min-h-28 w-full resize-y"
                  placeholder="Observações operacionais da venda."
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                />
              </div>
            </div>

            {mode === "create" ? (
              <SectionCard
                title="Itens da venda"
                subtitle="Cada linha calcula receita, taxa, custo, lucro e sinalização de preço mínimo por canal."
              >
                <div className="space-y-4">
                  {items.map((item, index) => {
                    const summary = calculateItemSummary(
                      item,
                      products,
                      channels,
                      form.channelId,
                      marginMinTarget,
                    );
                    const selectedProduct = products.find(
                      (product) => product.id === item.productId,
                    );

                    return (
                      <div
                        key={item.rowId}
                        className="rounded-2xl border border-black/10 bg-black/[0.02] p-4"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-vinho-900">
                              Item {index + 1}
                            </p>
                            <p className="text-xs text-black/45">
                              Custo operacional atual:{" "}
                              {selectedProduct
                                ? formatCurrency(selectedProduct.currentUnitCost)
                                : "—"}
                            </p>
                          </div>
                          <button
                            className="btn-secondary h-9 px-3"
                            onClick={() => removeItem(item.rowId)}
                            type="button"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="md:col-span-2">
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
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.sku} · {product.name}
                                </option>
                              ))}
                            </select>
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
                              Preço unitário
                            </label>
                            <input
                              className="input-soft w-full"
                              inputMode="decimal"
                              value={item.unitPrice}
                              onChange={(event) =>
                                updateItem(item.rowId, "unitPrice", event.target.value)
                              }
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                              Desconto total
                            </label>
                            <input
                              className="input-soft w-full"
                              inputMode="decimal"
                              value={item.discountAmount}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "discountAmount",
                                  event.target.value,
                                )
                              }
                            />
                          </div>

                          <div className="md:col-span-3 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-5">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                                Receita líquida
                              </p>
                              <p className="mt-1">{formatCurrency(summary.netRevenue)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                                Custo total
                              </p>
                              <p className="mt-1">{formatCurrency(summary.totalCost)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                                Lucro bruto
                              </p>
                              <p className="mt-1">{formatCurrency(summary.grossProfit)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                                Margem
                              </p>
                              <p className="mt-1">{formatPercent(summary.grossMarginPct)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                                Preço mínimo
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span>
                                  {summary.minimumUnitPrice
                                    ? formatCurrency(summary.minimumUnitPrice)
                                    : "—"}
                                </span>
                                <StatusBadge
                                  label={
                                    summary.belowMinPriceFlag
                                      ? "Abaixo do mínimo"
                                      : "Preço ok"
                                  }
                                  tone={
                                    summary.belowMinPriceFlag ? "warning" : "success"
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-black/15 bg-black/[0.03] px-4 py-3">
                    <div className="text-sm text-black/55">
                      Total previsto:{" "}
                      <span className="font-semibold text-vinho-900">
                        {formatCurrency(totalsPreview.netRevenue.toFixed(2))}
                      </span>
                    </div>
                    <button className="btn-secondary" onClick={addItem} type="button">
                      Adicionar item
                    </button>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <SectionCard
                title="Itens gravados"
                subtitle="Os itens, cálculos e movimentos de estoque permanecem congelados após a gravação. O PATCH fica restrito ao cabeçalho."
              >
                <div className="space-y-3">
                  {sale?.items.map((item) => (
                    <ReadOnlyItemRow item={item} key={item.id} />
                  ))}
                </div>
              </SectionCard>
            )}

            {(message || error) && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  error
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {error ?? message}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              {mode === "edit" && sale ? (
                <div className="text-xs text-black/45">
                  Criada em {formatDateTime(sale.createdAt)} · Atualizada em{" "}
                  {formatDateTime(sale.updatedAt)}
                </div>
              ) : (
                <p className="text-xs text-black/45">
                  O número operacional seguirá o padrão <strong>VEN-000001</strong>. O
                  pagamento não altera o estoque sem mudança real no status do pedido.
                </p>
              )}

              <button className="btn-primary" disabled={isPending} type="submit">
                {isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Salvar venda"
                    : "Atualizar cabeçalho"}
              </button>
            </div>
          </form>
        </SectionCard>

        {sale ? (
          <SectionCard
            title="Totais da venda"
            subtitle="Resumo persistido do pedido para auditoria operacional."
          >
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Receita bruta
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(sale.grossRevenue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Receita líquida
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(sale.netRevenue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Lucro bruto
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(sale.grossProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Margem bruta
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatPercent(sale.grossMarginPct)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <StatusBadge
                label={getPaymentStatusLabel(sale.paymentStatus)}
                tone={sale.paymentStatus === "paid" ? "success" : "warning"}
              />
              {sale.externalChargeReference ? (
                <span className="text-sm text-black/55">
                  Ref. externa: {sale.externalChargeReference}
                </span>
              ) : null}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
