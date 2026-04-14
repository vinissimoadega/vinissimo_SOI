"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { clientApiRequest } from "@/lib/client-api";
import type {
  CustomerListResponse,
  SaleAdditionalCostType,
  SaleChannelOption,
  SaleCustomerOption,
  SaleDetail,
  SalePaymentStatus,
  SaleProductOption,
} from "@/types";

type WhatsappQuickOrderProps = {
  products: SaleProductOption[];
  whatsappChannel: SaleChannelOption;
};

type QuickOrderItemDraft = {
  rowId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

type QuickCustomerDraft = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

type AdditionalCostDraft = {
  rowId: string;
  costType: SaleAdditionalCostType;
  description: string;
  amount: string;
  notes: string;
};

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

function buildItemDraft(products: SaleProductOption[]): QuickOrderItemDraft {
  const firstProduct = products[0];

  return {
    rowId: crypto.randomUUID(),
    productId: firstProduct?.id ?? "",
    quantity: "1.00",
    unitPrice: firstProduct?.currentUnitCost ?? "0.00",
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

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function normalizePhone(value: string) {
  return value.replace(/\D+/g, "");
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

function buildProfessionalSummary(
  sale: SaleDetail,
  customerName: string,
  channelName: string,
) {
  const lines = sale.items.map(
    (item) =>
      `- ${item.productName} (${item.productSku}) · ${item.quantity} x ${formatCurrency(
        item.unitPrice,
      )}`,
  );
  const additionalCostLines = sale.additionalCosts.map(
    (cost) =>
      `- ${getAdditionalCostTypeLabel(cost.costType)} · ${cost.description} · ${formatCurrency(
        cost.amount,
      )}`,
  );

  return [
    `Pedido ${sale.saleNumber}`,
    `Cliente: ${customerName}`,
    `Canal: ${channelName}`,
    "",
    "Itens:",
    ...lines,
    "",
    `Total do pedido: ${formatCurrency(sale.grossRevenue)}`,
    `Custos adicionais: ${formatCurrency(sale.additionalCostTotal)}`,
    `Pagamento: ${getPaymentStatusLabel(sale.paymentStatus)}`,
    "Instrução: confirmar pagamento manualmente antes de marcar como pago.",
    ...(additionalCostLines.length > 0
      ? ["", "Custos adicionais desta venda:", ...additionalCostLines]
      : []),
  ].join("\n");
}

function buildWhatsappMessage(
  sale: SaleDetail,
  customerName: string,
  channelName: string,
) {
  const lines = sale.items.map(
    (item) =>
      `${item.quantity}x ${item.productName} (${item.productSku}) — ${formatCurrency(
        item.grossRevenue,
      )}`,
  );

  return [
    `Olá, ${customerName}!`,
    `Seu pedido ${sale.saleNumber} foi montado pela Viníssimo.`,
    "",
    "Resumo:",
    ...lines,
    "",
    `Total do pedido: ${formatCurrency(sale.grossRevenue)}`,
    `Status do pagamento: ${getPaymentStatusLabel(sale.paymentStatus)}`,
    `Canal: ${channelName}`,
    "Assim que o pagamento for confirmado manualmente, seguimos com a entrega.",
  ].join("\n");
}

export function WhatsappQuickOrder({
  products,
  whatsappChannel,
}: WhatsappQuickOrderProps) {
  const router = useRouter();
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<SaleCustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SaleCustomerOption | null>(null);
  const [customerDraft, setCustomerDraft] = useState<QuickCustomerDraft>({
    fullName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [showCustomerCreator, setShowCustomerCreator] = useState(false);
  const [items, setItems] = useState<QuickOrderItemDraft[]>([
    buildItemDraft(products),
  ]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostDraft[]>([]);
  const [paymentStatus, setPaymentStatus] =
    useState<SalePaymentStatus>("unpaid");
  const [paymentNotes, setPaymentNotes] = useState(
    "Pagamento manual via WhatsApp. Confirmar antes de marcar como pago.",
  );
  const [orderNotes, setOrderNotes] = useState(
    "Pedido recebido via WhatsApp e lançado em fluxo rápido.",
  );
  const [createdSale, setCreatedSale] = useState<SaleDetail | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [assistMessage, setAssistMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const search = customerSearch.trim();

    if (search.length < 2) {
      setCustomerResults(selectedCustomer ? [selectedCustomer] : []);
      setIsSearchingCustomer(false);
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
        setAssistMessage(
          response.items.length > 0
            ? "Selecione o cliente ou finalize o cadastro rápido."
            : "Nenhum cliente encontrado com esse termo.",
        );
      } catch (searchError) {
        if (!active) {
          return;
        }

        setAssistMessage(
          searchError instanceof Error
            ? searchError.message
            : "Não foi possível buscar o cliente agora.",
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
  }, [customerSearch, selectedCustomer]);

  const totals = useMemo(() => {
    const itemsTotal = items.reduce((accumulator, item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return accumulator + quantity * unitPrice;
    }, 0);
    const additionalCostTotal = additionalCosts.reduce((accumulator, item) => {
      return accumulator + Number(item.amount || 0);
    }, 0);

    return {
      itemsTotal,
      additionalCostTotal,
    };
  }, [additionalCosts, items]);

  function updateItem(rowId: string, field: keyof QuickOrderItemDraft, value: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.rowId !== rowId) return item;

        const nextItem = {
          ...item,
          [field]: value,
        };

        if (field === "productId") {
          const product = products.find((candidate) => candidate.id === value);
          if (product) {
            nextItem.unitPrice = product.currentUnitCost;
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
    setItems((current) => [...current, buildItemDraft(products)]);
  }

  function removeItem(rowId: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.rowId !== rowId) : current,
    );
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
    setCustomerResults([customer]);
    setAssistMessage("Cliente selecionado para o pedido rápido.");
    setShowCustomerCreator(false);
    setCustomerDraft((current) => ({
      ...current,
      fullName: customer.fullName,
      phone: customer.phone ?? current.phone,
      email: customer.email ?? current.email,
    }));
  }

  async function ensureCustomer() {
    if (selectedCustomer) {
      return selectedCustomer;
    }

    if (!customerDraft.fullName.trim()) {
      throw new Error("Informe o nome para cadastrar o cliente rápido.");
    }

    setIsCreatingCustomer(true);

    try {
      const createdCustomer = await clientApiRequest<SaleCustomerOption>("/customers", {
        method: "POST",
        body: JSON.stringify({
          fullName: customerDraft.fullName.trim(),
          phone: normalizePhone(customerDraft.phone) || null,
          email: customerDraft.email.trim() || null,
          acquisitionChannelId: whatsappChannel.id,
          notes:
            customerDraft.notes.trim() ||
            "Cliente criado via fluxo de venda rápida do WhatsApp.",
        }),
      });

      setSelectedCustomer(createdCustomer);
      setCustomerResults([createdCustomer]);
      setMessage("Cliente criado rapidamente e pronto para o pedido.");
      return createdCustomer;
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const customer = await ensureCustomer();

      const sale = await clientApiRequest<SaleDetail>("/sales", {
        method: "POST",
        body: JSON.stringify({
          saleDate: new Date().toISOString().slice(0, 10),
          customerId: customer.id,
          channelId: whatsappChannel.id,
          orderStatus: "pending",
          paymentStatus,
          paymentNotes,
          notes: orderNotes || null,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: "0.00",
          })),
          additionalCosts: additionalCosts
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
            })),
        }),
      });

      const summary = buildProfessionalSummary(
        sale,
        customer.fullName,
        whatsappChannel.channelName,
      );
      const whatsappMessage = buildWhatsappMessage(
        sale,
        customer.fullName,
        whatsappChannel.channelName,
      );

      setCreatedSale(sale);
      setGeneratedSummary(summary);
      setGeneratedMessage(whatsappMessage);
      setMessage("Pedido rápido criado com sucesso.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível registrar a venda rápida.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setError("Não foi possível copiar automaticamente. Copie o texto manualmente.");
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Identificação do cliente"
        subtitle="Busque por nome, telefone ou email. Se não existir, cadastre o cliente sem sair do fluxo do pedido."
      >
        <div className="grid gap-3 md:grid-cols-[2fr_auto]">
          <input
            className="input-soft"
            placeholder="Busque por nome, telefone ou email"
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              if (selectedCustomer && event.target.value !== selectedCustomer.fullName) {
                setSelectedCustomer(null);
              }
            }}
          />
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setShowCustomerCreator((current) => !current)}
          >
            {showCustomerCreator ? "Fechar cadastro" : "Cadastrar cliente agora"}
          </button>
        </div>

        {assistMessage ? <p className="mt-3 text-sm text-black/55">{assistMessage}</p> : null}
        {isSearchingCustomer ? (
          <p className="mt-3 text-sm text-black/55">Buscando clientes...</p>
        ) : null}

        {customerResults.length > 0 ? (
          <div className="mt-4 space-y-2">
            {customerResults.map((customer) => (
              <button
                key={customer.id}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selectedCustomer?.id === customer.id
                    ? "border-vinho-700 bg-vinho-50"
                    : "border-black/10 bg-white"
                }`}
                type="button"
                onClick={() => selectCustomer(customer)}
              >
                <p className="font-semibold text-vinho-950">
                  {customer.fullName} · {customer.customerCode ?? "Sem código"}
                </p>
                <p className="mt-1 text-sm text-black/55">
                  {customer.phone ?? "Sem telefone"} · {customer.email ?? "Sem email"}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {showCustomerCreator ? (
          <div className="mt-4 grid gap-4 rounded-2xl border border-dashed border-black/15 bg-black/[0.03] p-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Nome do cliente
              </label>
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
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Telefone
              </label>
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
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Email
              </label>
              <input
                className="input-soft w-full"
                placeholder="email@cliente.com"
                value={customerDraft.email}
                onChange={(event) =>
                  setCustomerDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Observação do cadastro rápido
              </label>
              <textarea
                className="input-soft min-h-24 w-full resize-y"
                placeholder="Ex.: cliente veio pelo WhatsApp querendo presente para jantar."
                value={customerDraft.notes}
                onChange={(event) =>
                  setCustomerDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        ) : null}

        {selectedCustomer ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Cliente selecionado</p>
            <p className="mt-1 text-sm text-emerald-800">
              {selectedCustomer.fullName} · {selectedCustomer.customerCode ?? "Sem código"}
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Montagem rápida do pedido"
        subtitle="Canal pré-selecionado como WhatsApp, pedido pendente e pagamento tratado separadamente."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Canal
              </label>
              <div className="input-soft flex min-h-11 items-center">
                {whatsappChannel.channelName}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Status do pedido
              </label>
              <div className="input-soft flex min-h-11 items-center">Pendente</div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Pagamento
              </label>
              <select
                className="input-soft w-full"
                value={paymentStatus}
                onChange={(event) =>
                  setPaymentStatus(event.target.value as SalePaymentStatus)
                }
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.rowId}
                className="grid gap-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4 md:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <select
                  className="input-soft"
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
                <input
                  className="input-soft"
                  inputMode="decimal"
                  placeholder="Quantidade"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(item.rowId, "quantity", event.target.value)
                  }
                />
                <input
                  className="input-soft"
                  inputMode="decimal"
                  placeholder="Valor unitário"
                  value={item.unitPrice}
                  onChange={(event) =>
                    updateItem(item.rowId, "unitPrice", event.target.value)
                  }
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => removeItem(item.rowId)}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary" type="button" onClick={addItem}>
              Adicionar item
            </button>
            <p className="text-sm text-black/55">
              Total prévio dos itens: {formatCurrency(totals.itemsTotal.toFixed(2))}
            </p>
          </div>

          <SectionCard
            title="Custos adicionais da venda"
            subtitle="Use apenas quando houver custo exclusivo deste pedido, sem depender de despesa geral."
          >
            <div className="space-y-4">
              {additionalCosts.map((cost) => (
                <div
                  key={cost.rowId}
                  className="grid gap-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4 md:grid-cols-[1.4fr_1.6fr_1fr_auto]"
                >
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
                    className="input-soft"
                    placeholder="Descrição operacional do custo"
                    value={cost.description}
                    onChange={(event) =>
                      updateAdditionalCost(cost.rowId, "description", event.target.value)
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
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => removeAdditionalCost(cost.rowId)}
                  >
                    Remover
                  </button>
                  <textarea
                    className="input-soft min-h-24 w-full resize-y md:col-span-4"
                    placeholder="Observação opcional do custo adicional."
                    value={cost.notes}
                    onChange={(event) =>
                      updateAdditionalCost(cost.rowId, "notes", event.target.value)
                    }
                  />
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-black/15 bg-black/[0.03] px-4 py-3">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={addAdditionalCost}
                >
                  Adicionar custo adicional
                </button>
                <p className="text-sm text-black/55">
                  Custos adicionais: {formatCurrency(totals.additionalCostTotal.toFixed(2))}
                </p>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Observação da cobrança
              </label>
              <textarea
                className="input-soft min-h-24 w-full resize-y"
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
                Observação interna do pedido
              </label>
              <textarea
                className="input-soft min-h-24 w-full resize-y"
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-4">
            <p className="text-xs text-black/45">
              A venda rápida gera número automático do pedido, busca cliente de verdade
              por nome/telefone/email e mantém pagamento separado do estoque.
            </p>
            <button className="btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : "Criar pedido rápido"}
            </button>
          </div>
        </form>

        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </SectionCard>

      {createdSale ? (
        <SectionCard
          title="Resumo profissional do pedido"
          subtitle="Texto pronto para conferência interna e mensagem pronta para copiar no WhatsApp."
          action={
            <Link className="btn-secondary" href={`/sales/${createdSale.id}`}>
              Abrir pedido
            </Link>
          }
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge label={createdSale.saleNumber} tone="medium" />
                <StatusBadge
                  label={getPaymentStatusLabel(createdSale.paymentStatus)}
                  tone={
                    createdSale.paymentStatus === "paid"
                      ? "success"
                      : createdSale.paymentStatus === "pending_confirmation"
                        ? "warning"
                        : "low"
                  }
                />
              </div>
              <textarea
                className="input-soft min-h-80 w-full resize-y"
                readOnly
                value={generatedSummary}
              />
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  copyToClipboard(generatedSummary, "Resumo profissional copiado.")
                }
              >
                Copiar resumo profissional
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 text-sm text-black/60">
                <p>
                  Total dos itens: {formatCurrency(createdSale.grossRevenue)} · Custos
                  adicionais: {formatCurrency(createdSale.additionalCostTotal)}
                </p>
                <p className="mt-1">
                  Lucro da venda: {formatCurrency(createdSale.grossProfit)} · Margem da
                  venda:{" "}
                  {createdSale.grossMarginPct
                    ? `${(Number(createdSale.grossMarginPct) * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <textarea
                className="input-soft min-h-80 w-full resize-y"
                readOnly
                value={generatedMessage}
              />
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  copyToClipboard(generatedMessage, "Mensagem pronta para WhatsApp copiada.")
                }
              >
                Copiar mensagem para WhatsApp
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
