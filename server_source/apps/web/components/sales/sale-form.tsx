"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { BarcodeScannerSheet } from "@/components/scanner/barcode-scanner-sheet";
import { clientApiRequest } from "@/lib/client-api";
import { lookupProductBySku } from "@/lib/product-sku-lookup";
import type {
  CustomerListResponse,
  ProductSkuLookupItem,
  SaleAdditionalCost,
  SaleAdditionalCostType,
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

type AdditionalCostDraft = {
  rowId: string;
  costType: SaleAdditionalCostType;
  description: string;
  amount: string;
  notes: string;
};

type InlineCustomerDraft = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

const ORDER_STATUS_OPTIONS: Array<{
  value: SaleOrderStatus;
  label: string;
}> = [
  { value: "pending", label: "Pendente" },
  { value: "delivered", label: "Entregue" },
  { value: "canceled", label: "Cancelado" },
];

const PAYMENT_STATUS_OPTIONS: Array<{
  value: SalePaymentStatus;
  label: string;
}> = [
  { value: "unpaid", label: "Não pago" },
  { value: "pending_confirmation", label: "Aguardando confirmação" },
  { value: "paid", label: "Pago" },
  { value: "failed", label: "Falhou" },
  { value: "refunded", label: "Estornado" },
];

const ADDITIONAL_COST_TYPE_OPTIONS: Array<{
  value: SaleAdditionalCostType;
  label: string;
}> = [
  { value: "custom_card", label: "Cartão personalizado" },
  { value: "special_packaging", label: "Embalagem especial" },
  { value: "subsidized_shipping", label: "Frete subsidiado" },
  { value: "extra_delivery", label: "Custo extra de entrega" },
  { value: "other", label: "Outro" },
];

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

function normalizePhone(value: string) {
  return value.replace(/\D+/g, "");
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
  return (
    PAYMENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Não pago"
  );
}

function getAdditionalCostTypeLabel(costType: SaleAdditionalCostType) {
  return (
    ADDITIONAL_COST_TYPE_OPTIONS.find((option) => option.value === costType)?.label ??
    "Outro"
  );
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

function buildAdditionalCostDraft(): AdditionalCostDraft {
  return {
    rowId: crypto.randomUUID(),
    costType: "other",
    description: "",
    amount: "0.00",
    notes: "",
  };
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
          Lucro do item
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
  const [availableProducts, setAvailableProducts] = useState(products);
  const initialCustomer =
    customers.find((customer) => customer.id === sale?.customerId) ??
    (sale?.customerId
      ? {
          id: sale.customerId,
          customerCode: null,
          fullName: sale.customerName ?? "Cliente selecionado",
          email: null,
          phone: null,
          isActive: true,
        }
      : null);

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
    mode === "create"
      ? [buildItemDraft(availableProducts), buildItemDraft(availableProducts)]
      : [],
  );
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostDraft[]>(
    mode === "create" ? [] : [],
  );
  const [customerSearch, setCustomerSearch] = useState(
    initialCustomer?.fullName ?? "",
  );
  const [customerResults, setCustomerResults] = useState<SaleCustomerOption[]>(
    initialCustomer ? [initialCustomer] : customers.slice(0, 6),
  );
  const [selectedCustomer, setSelectedCustomer] = useState<SaleCustomerOption | null>(
    initialCustomer,
  );
  const [showCustomerCreator, setShowCustomerCreator] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<InlineCustomerDraft>({
    fullName: initialCustomer?.fullName ?? "",
    phone: initialCustomer?.phone ?? "",
    email: initialCustomer?.email ?? "",
    notes: "",
  });
  const [customerAssistMessage, setCustomerAssistMessage] = useState<string | null>(
    initialCustomer ? "Cliente já vinculado à venda." : null,
  );
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerRowId, setScannerRowId] = useState<string | null>(null);
  const [scannerActionHref, setScannerActionHref] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const search = customerSearch.trim();

    if (search.length < 2) {
      setIsSearchingCustomer(false);
      setCustomerResults(selectedCustomer ? [selectedCustomer] : customers.slice(0, 6));
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setIsSearchingCustomer(true);

      try {
        const response = await clientApiRequest<CustomerListResponse>(
          `/customers?search=${encodeURIComponent(search)}&page=1&page_size=8`,
        );

        if (!active) {
          return;
        }

        setCustomerResults(
          response.items.map((customer) => ({
            id: customer.id,
            customerCode: customer.customerCode,
            fullName: customer.fullName,
            email: customer.email,
            phone: customer.phone,
            isActive: customer.isActive,
          })),
        );
        setCustomerAssistMessage(
          response.items.length > 0
            ? "Selecione um cliente existente ou cadastre um novo."
            : "Nenhum cliente encontrado com esse termo.",
        );
      } catch (searchError) {
        if (!active) {
          return;
        }

        setCustomerAssistMessage(
          searchError instanceof Error
            ? searchError.message
            : "Não foi possível buscar clientes agora.",
        );
      } finally {
        if (active) {
          setIsSearchingCustomer(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [customerSearch, customers, selectedCustomer]);

  const totalsPreview = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        const summary = calculateItemSummary(
          item,
          availableProducts,
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
  }, [availableProducts, channels, form.channelId, items, marginMinTarget]);

  const additionalCostTotal = useMemo(
    () =>
      additionalCosts.reduce((accumulator, item) => {
        return accumulator + Number(item.amount || 0);
      }, 0),
    [additionalCosts],
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
          const selectedProduct = availableProducts.find(
            (product) => product.id === value,
          );

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

  function updateAdditionalCost(
    rowId: string,
    field: keyof AdditionalCostDraft,
    value: string,
  ) {
    setAdditionalCosts((current) =>
      current.map((item) =>
        item.rowId === rowId ? { ...item, [field]: value } : item,
      ),
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
          currentUnitCost: product.currentUnitCost ?? "0.00",
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
      setError("Escolha a linha da venda antes de usar a câmera.");
      return;
    }

    const lookup = await lookupProductBySku(sku);

    if (!lookup.found || !lookup.product) {
      setError(
        `O SKU ${lookup.sku} ainda não está cadastrado. Cadastre o produto para seguir com esta venda.`,
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
          unitPrice:
            item.unitPrice.trim() === "" || item.unitPrice === "0.00"
              ? lookup.product!.currentUnitCost ?? item.unitPrice
              : item.unitPrice,
        };
      }),
    );
    setMessage(
      `Produto localizado pela câmera: ${lookup.product.sku} · ${lookup.product.name}. Item da venda preenchido automaticamente.`,
    );
    setScannerActionHref(`/products/${lookup.product.id}`);
  }

  function addAdditionalCost() {
    setAdditionalCosts((current) => [...current, buildAdditionalCostDraft()]);
  }

  function removeAdditionalCost(rowId: string) {
    setAdditionalCosts((current) => current.filter((item) => item.rowId !== rowId));
  }

  function selectCustomer(customer: SaleCustomerOption) {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.fullName);
    setCustomerResults((current) => [
      customer,
      ...current.filter((item) => item.id !== customer.id),
    ]);
    setCustomerAssistMessage("Cliente selecionado para esta venda.");
    setShowCustomerCreator(false);
    setForm((current) => ({
      ...current,
      customerId: customer.id,
    }));
    setCustomerDraft((current) => ({
      ...current,
      fullName: customer.fullName,
      phone: customer.phone ?? current.phone,
      email: customer.email ?? current.email,
    }));
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerResults(customers.slice(0, 6));
    setCustomerAssistMessage("Venda seguirá sem cliente até você selecionar ou cadastrar.");
    setForm((current) => ({
      ...current,
      customerId: "",
    }));
  }

  async function handleCreateCustomerInline() {
    setIsCreatingCustomer(true);
    setError(null);
    setMessage(null);

    try {
      const createdCustomer = await clientApiRequest<SaleCustomerOption>("/customers", {
        method: "POST",
        body: JSON.stringify({
          fullName: customerDraft.fullName.trim(),
          phone: normalizePhone(customerDraft.phone) || null,
          email: customerDraft.email.trim() || null,
          acquisitionChannelId: form.channelId || null,
          notes:
            customerDraft.notes.trim() ||
            "Cliente criado inline no fluxo operacional de venda.",
        }),
      });

      selectCustomer(createdCustomer);
      setMessage("Cliente cadastrado e vinculado à venda.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível cadastrar o cliente agora.",
      );
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setError(null);

    const preparedAdditionalCosts = additionalCosts
      .filter(
        (item) =>
          item.description.trim() ||
          item.notes.trim() ||
          Number(item.amount || 0) > 0,
      )
      .map((item) => ({
        costType: item.costType,
        description: item.description,
        amount: item.amount,
        notes: item.notes || null,
      }));

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
          additionalCosts: preparedAdditionalCosts,
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
      ? "Registre um pedido com busca real de cliente, cadastro inline, custos adicionais e numeração automática."
      : "Edição restrita ao cabeçalho, status e pagamento. Itens, custos adicionais e movimentos permanecem auditáveis.";
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
          subtitle="Canal, cliente pesquisável, data operacional, status do pedido e estado do pagamento."
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

              <div className="space-y-3">
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-black/45">
                    Cliente
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {selectedCustomer ? (
                      <button
                        className="btn-secondary h-11 w-full px-3 sm:h-9 sm:w-auto"
                        type="button"
                        onClick={clearSelectedCustomer}
                      >
                        Limpar cliente
                      </button>
                    ) : null}
                    <button
                      className="btn-secondary h-11 w-full px-3 sm:h-9 sm:w-auto"
                      type="button"
                      onClick={() => setShowCustomerCreator((current) => !current)}
                    >
                      {showCustomerCreator
                        ? "Fechar cadastro"
                        : "Cadastrar cliente agora"}
                    </button>
                  </div>
                </div>

                <input
                  className="input-soft w-full"
                  placeholder="Busque por nome, telefone ou email"
                  value={customerSearch}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value);
                    if (selectedCustomer && event.target.value !== selectedCustomer.fullName) {
                      setSelectedCustomer(null);
                      setForm((current) => ({ ...current, customerId: "" }));
                    }
                  }}
                />

                {customerAssistMessage ? (
                  <p className="text-xs text-black/45">{customerAssistMessage}</p>
                ) : null}

                {isSearchingCustomer ? (
                  <p className="text-xs text-black/45">Buscando clientes...</p>
                ) : null}

                {customerResults.length > 0 ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-black/10 bg-black/[0.02] p-3">
                    {customerResults.map((customer) => (
                      <button
                        key={customer.id}
                        className={`w-full rounded-2xl border p-3 text-left transition ${
                          form.customerId === customer.id
                            ? "border-vinho-700 bg-vinho-50"
                            : "border-black/10 bg-white"
                        }`}
                        type="button"
                        onClick={() => selectCustomer(customer)}
                      >
                        <p className="font-semibold text-vinho-950">
                          {customer.fullName}
                        </p>
                        <p className="mt-1 text-sm text-black/55">
                          {customer.customerCode ?? "Sem código"} ·{" "}
                          {customer.phone ?? "Sem telefone"} ·{" "}
                          {customer.email ?? "Sem email"}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}

                {showCustomerCreator ? (
                  <div className="space-y-3 rounded-2xl border border-dashed border-black/15 bg-black/[0.03] p-4">
                    <p className="text-sm font-semibold text-vinho-950">
                      Cadastro inline do cliente
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="input-soft w-full"
                        placeholder="Nome completo"
                        value={customerDraft.fullName}
                        onChange={(event) =>
                          setCustomerDraft((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="input-soft w-full"
                        placeholder="Telefone"
                        value={customerDraft.phone}
                        onChange={(event) =>
                          setCustomerDraft((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="input-soft w-full md:col-span-2"
                        placeholder="email@cliente.com"
                        value={customerDraft.email}
                        onChange={(event) =>
                          setCustomerDraft((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                      />
                      <textarea
                        className="input-soft min-h-24 w-full resize-y md:col-span-2"
                        placeholder="Contexto útil da venda, ocasião ou preferência."
                        value={customerDraft.notes}
                        onChange={(event) =>
                          setCustomerDraft((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex justify-stretch sm:justify-end">
                      <button
                        className="btn-primary w-full sm:w-auto"
                        disabled={isCreatingCustomer}
                        type="button"
                        onClick={handleCreateCustomerInline}
                      >
                        {isCreatingCustomer
                          ? "Salvando cliente..."
                          : "Salvar cliente e voltar para a venda"}
                      </button>
                    </div>
                  </div>
                ) : null}
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
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
              <>
                <SectionCard
                  title="Itens da venda"
                  subtitle="Cada linha calcula receita, taxa, custo, lucro e sinalização de preço mínimo por canal."
                >
                  <div className="space-y-4">
                    {items.map((item, index) => {
                      const summary = calculateItemSummary(
                        item,
                        availableProducts,
                        channels,
                        form.channelId,
                        marginMinTarget,
                      );
                      const selectedProduct = availableProducts.find(
                        (product) => product.id === item.productId,
                      );

                      return (
                        <div
                          key={item.rowId}
                          className="rounded-2xl border border-black/10 bg-black/[0.02] p-4"
                        >
                          <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
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
                              className="btn-secondary h-11 w-full px-3 sm:h-9 sm:w-auto"
                              onClick={() => {
                                setScannerRowId(item.rowId);
                                setIsScannerOpen(true);
                              }}
                              type="button"
                            >
                              Ler código pela câmera
                            </button>
                            <button
                              className="btn-secondary h-11 w-full px-3 sm:h-9 sm:w-auto"
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
                                {availableProducts.map((product) => (
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
                                  Lucro do item
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

                    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-black/15 bg-black/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-black/55">
                        Receita líquida prevista:{" "}
                        <span className="font-semibold text-vinho-900">
                          {formatCurrency(totalsPreview.netRevenue.toFixed(2))}
                        </span>
                      </div>
                      <button className="btn-secondary w-full sm:w-auto" onClick={addItem} type="button">
                        Adicionar item
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Custos adicionais da venda"
                  subtitle="Use para custos exclusivos desta venda, como cartão personalizado, embalagem especial ou frete subsidiado."
                >
                  <div className="space-y-4">
                    {additionalCosts.length === 0 ? (
                      <p className="text-sm text-black/55">
                        Nenhum custo adicional lançado. Use esta área apenas quando o custo
                        estiver vinculado a esta venda específica.
                      </p>
                    ) : null}

                    {additionalCosts.map((cost, index) => (
                      <div
                        key={cost.rowId}
                        className="rounded-2xl border border-black/10 bg-black/[0.02] p-4"
                      >
                        <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                          <p className="text-sm font-semibold text-vinho-900">
                            Custo adicional {index + 1}
                          </p>
                          <button
                            className="btn-secondary h-11 w-full px-3 sm:h-9 sm:w-auto"
                            type="button"
                            onClick={() => removeAdditionalCost(cost.rowId)}
                          >
                            Remover
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <select
                            className="input-soft"
                            value={cost.costType}
                            onChange={(event) =>
                              updateAdditionalCost(cost.rowId, "costType", event.target.value)
                            }
                          >
                            {ADDITIONAL_COST_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            className="input-soft md:col-span-2"
                            placeholder="Descrição operacional do custo"
                            value={cost.description}
                            onChange={(event) =>
                              updateAdditionalCost(
                                cost.rowId,
                                "description",
                                event.target.value,
                              )
                            }
                          />
                          <input
                            className="input-soft"
                            inputMode="decimal"
                            placeholder="Valor"
                            value={cost.amount}
                            onChange={(event) =>
                              updateAdditionalCost(cost.rowId, "amount", event.target.value)
                            }
                          />
                          <textarea
                            className="input-soft min-h-24 w-full resize-y md:col-span-4"
                            placeholder="Observação opcional do custo adicional."
                            value={cost.notes}
                            onChange={(event) =>
                              updateAdditionalCost(cost.rowId, "notes", event.target.value)
                            }
                          />
                        </div>
                      </div>
                    ))}

                    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-black/15 bg-black/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-black/55">
                        Custos adicionais:{" "}
                        <span className="font-semibold text-vinho-900">
                          {formatCurrency(additionalCostTotal.toFixed(2))}
                        </span>
                      </div>
                      <button
                        className="btn-secondary w-full sm:w-auto"
                        type="button"
                        onClick={addAdditionalCost}
                      >
                        Adicionar custo adicional
                      </button>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : (
              <>
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

                <SectionCard
                  title="Custos adicionais da venda"
                  subtitle="Leitura auditável dos custos exclusivos deste pedido."
                >
                  {sale?.additionalCosts.length ? (
                    <div className="space-y-3">
                      {sale.additionalCosts.map((cost: SaleAdditionalCost) => (
                        <div
                          key={cost.id}
                          className="rounded-2xl border border-black/10 bg-black/[0.02] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-vinho-950">
                                {getAdditionalCostTypeLabel(cost.costType)}
                              </p>
                              <p className="mt-1 text-sm text-black/60">
                                {cost.description}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-vinho-900">
                              {formatCurrency(cost.amount)}
                            </p>
                          </div>
                          {cost.notes ? (
                            <p className="mt-3 text-sm text-black/60">{cost.notes}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-black/55">
                      Nenhum custo adicional foi lançado nesta venda.
                    </p>
                  )}
                </SectionCard>
              </>
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

            {scannerActionHref ? (
              <div className="flex justify-start">
                <Link className="btn-secondary w-full sm:w-auto" href={scannerActionHref}>
                  {scannerActionHref.startsWith("/products/new")
                    ? "Cadastrar produto com este SKU"
                    : "Abrir produto encontrado"}
                </Link>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {mode === "edit" && sale ? (
                <div className="text-xs text-black/45">
                  Criada em {formatDateTime(sale.createdAt)} · Atualizada em{" "}
                  {formatDateTime(sale.updatedAt)}
                </div>
              ) : (
                <p className="text-xs text-black/45">
                  O número operacional seguirá o padrão <strong>VEN-000001</strong>. O
                  pagamento não altera o estoque sem mudança real no status do pedido, e
                  custos adicionais desta venda recalculam a margem do pedido.
                </p>
              )}

              <button className="btn-primary w-full sm:w-auto" disabled={isPending} type="submit">
                {isPending
                  ? "Salvando..."
                  : mode === "create"
                    ? "Salvar venda"
                    : "Atualizar cabeçalho"}
              </button>
            </div>
          </form>
        </SectionCard>

        {mode === "create" ? (
          <BarcodeScannerSheet
            description="Aponte a câmera para o código de barras do vinho. O SKU será validado e aplicado no item selecionado."
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onDetected={async ({ sku }) => {
              await handleDetectedSku(sku);
            }}
            title="Ler código pela câmera"
          />
        ) : null}

        {sale ? (
          <SectionCard
            title="Totais da venda"
            subtitle="Resumo persistido do pedido para auditoria operacional."
          >
            <div className="grid gap-4 md:grid-cols-5">
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
                  Custos adicionais
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(sale.additionalCostTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Lucro da venda
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(sale.grossProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Margem da venda
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
        ) : (
          <SectionCard
            title="Resumo previsto"
            subtitle="A margem final considera taxa do canal, custo operacional dos itens e custos adicionais exclusivos da venda."
          >
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Receita bruta
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(totalsPreview.grossRevenue.toFixed(2))}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Receita líquida
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(totalsPreview.netRevenue.toFixed(2))}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Custos adicionais
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(additionalCostTotal.toFixed(2))}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Lucro da venda
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatCurrency(
                    (totalsPreview.grossProfit - additionalCostTotal).toFixed(2),
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                  Margem da venda
                </p>
                <p className="mt-1 text-lg font-semibold text-vinho-900">
                  {formatPercent(
                    totalsPreview.netRevenue > 0
                      ? (
                          (totalsPreview.grossProfit - additionalCostTotal) /
                          totalsPreview.netRevenue
                        ).toFixed(4)
                      : null,
                  )}
                </p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
