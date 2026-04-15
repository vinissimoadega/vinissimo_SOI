"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { clientApiRequest } from "@/lib/client-api";
import type {
  ExpenseChannelOption,
  ExpenseCostNature,
  ExpenseListItem,
  ExpensePaymentMethod,
} from "@/types";

type ExpenseFormProps = {
  channels: ExpenseChannelOption[];
  availableCostNatures: ExpenseCostNature[];
  availablePaymentMethods: ExpensePaymentMethod[];
};

function getPaymentMethodLabel(value: ExpensePaymentMethod) {
  switch (value) {
    case "credit_card":
      return "Cartão de crédito";
    case "debit_card":
      return "Cartão de débito";
    case "bank_transfer":
      return "Transferência";
    default:
      return value === "pix" ? "Pix" : value === "cash" ? "Dinheiro" : "Outro";
  }
}

function getCostNatureLabel(value: ExpenseCostNature) {
  return value === "fixed" ? "Fixa" : "Variável";
}

export function ExpenseForm({
  channels,
  availableCostNatures,
  availablePaymentMethods,
}: ExpenseFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    expenseType: "",
    category: "",
    description: "",
    amount: "",
    channelId: "",
    costNature: "variable" as ExpenseCostNature,
    paymentMethod: "other" as ExpensePaymentMethod,
    notes: "",
  });
  const [createdExpense, setCreatedExpense] = useState<ExpenseListItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const normalizedAmount = useMemo(() => {
    const amount = Number(form.amount.replace(",", ".") || 0);
    return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
  }, [form.amount]);

  function updateField<Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      const created = await clientApiRequest<ExpenseListItem>("/expenses", {
        method: "POST",
        body: JSON.stringify({
          expenseDate: form.expenseDate,
          expenseType: form.expenseType,
          category: form.category,
          description: form.description,
          amount: form.amount,
          channelId: form.channelId || null,
          costNature: form.costNature,
          paymentMethod: form.paymentMethod,
          notes: form.notes || null,
        }),
      });

      setCreatedExpense(created);
      setMessage("Despesa registrada com sucesso.");
      setForm({
        expenseDate: new Date().toISOString().slice(0, 10),
        expenseType: "",
        category: "",
        description: "",
        amount: "",
        channelId: "",
        costNature: "variable",
        paymentMethod: "other",
        notes: "",
      });
      startTransition(() => router.refresh());
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível registrar a despesa.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <SectionCard
      title="Nova despesa"
      subtitle="Fluxo mínimo funcional para registrar custo operacional com data, categoria, forma de pagamento e observação."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Data
            </label>
            <input
              className="input-soft w-full"
              type="date"
              value={form.expenseDate}
              onChange={(event) => updateField("expenseDate", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Categoria
            </label>
            <input
              className="input-soft w-full"
              placeholder="Ex.: Operação, Embalagem, Logística"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Tipo
            </label>
            <input
              className="input-soft w-full"
              placeholder="Ex.: Frete, embalagem, taxa"
              value={form.expenseType}
              onChange={(event) => updateField("expenseType", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Valor
            </label>
            <input
              className="input-soft w-full"
              inputMode="decimal"
              placeholder="0,00"
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
            />
            <p className="mt-1 text-xs text-black/45">
              Valor normalizado: R$ {normalizedAmount.replace(".", ",")}
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Descrição
            </label>
            <input
              className="input-soft w-full"
              placeholder="Descreva a despesa de forma objetiva"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Natureza
            </label>
            <select
              className="input-soft w-full"
              value={form.costNature}
              onChange={(event) =>
                updateField("costNature", event.target.value as ExpenseCostNature)
              }
            >
              {availableCostNatures.map((costNature) => (
                <option key={costNature} value={costNature}>
                  {getCostNatureLabel(costNature)}
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
              value={form.paymentMethod}
              onChange={(event) =>
                updateField(
                  "paymentMethod",
                  event.target.value as ExpensePaymentMethod,
                )
              }
            >
              {availablePaymentMethods.map((paymentMethod) => (
                <option key={paymentMethod} value={paymentMethod}>
                  {getPaymentMethodLabel(paymentMethod)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Canal
            </label>
            <select
              className="input-soft w-full"
              value={form.channelId}
              onChange={(event) => updateField("channelId", event.target.value)}
            >
              <option value="">Despesa geral</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.channelName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-black/45">
              Observação
            </label>
            <textarea
              className="input-soft min-h-24 w-full resize-y"
              placeholder="Contexto opcional para auditoria operacional."
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/5 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs text-black/45">
            O cadastro de despesa não altera estoque nem dashboard executivo além do que já for lido por custos operacionais.
          </p>
          <button className="btn-primary w-full sm:w-auto" disabled={isPending} type="submit">
            {isPending ? "Salvando..." : "Registrar despesa"}
          </button>
        </div>
      </form>

      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {createdExpense ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Despesa criada</p>
          <p className="mt-1">
            {createdExpense.expenseType} · {createdExpense.category} · R${" "}
            {createdExpense.amount}
          </p>
          <p className="mt-1 text-emerald-700">
            {createdExpense.channelName ?? "Despesa geral"} ·{" "}
            {getPaymentMethodLabel(createdExpense.paymentMethod)}
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
