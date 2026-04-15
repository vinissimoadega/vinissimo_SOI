"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ApiRequestError, clientApiRequest } from "@/lib/client-api";
import type {
  FinancialChannelRule,
  FinancialPayableItem,
  FinancialReceivableItem,
  FinancialSettlementBatch,
} from "@/types";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível concluir a ação.";
}

export function ReceivableActions({
  receivable,
}: {
  receivable: FinancialReceivableItem;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    expectedReceiptDate: receivable.expectedReceiptDate.slice(0, 10),
    actualReceiptDate: receivable.actualReceiptDate?.slice(0, 10) ?? "",
    amountReceived: receivable.amountReceived,
    notes: receivable.notes ?? "",
    status: receivable.status,
  });

  function patch(body: Record<string, unknown>, successMessage: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await clientApiRequest(`/financial/receivables/${receivable.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        <input
          className="input-soft h-10"
          type="date"
          value={formState.expectedReceiptDate}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              expectedReceiptDate: event.target.value,
            }))
          }
        />
        <input
          className="input-soft h-10"
          type="date"
          value={formState.actualReceiptDate}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              actualReceiptDate: event.target.value,
            }))
          }
        />
        <input
          className="input-soft h-10"
          inputMode="decimal"
          placeholder="Valor recebido"
          value={formState.amountReceived}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              amountReceived: event.target.value,
            }))
          }
        />
        <select
          className="input-soft h-10"
          value={formState.status}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              status: event.target.value as FinancialReceivableItem["status"],
            }))
          }
        >
          <option value="previsto">Previsto</option>
          <option value="recebido_parcial">Recebido parcial</option>
          <option value="recebido">Recebido</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <button
          className="btn-primary h-10"
          disabled={isPending}
          onClick={() =>
            patch(
              {
                expectedReceiptDate: formState.expectedReceiptDate,
                actualReceiptDate: formState.actualReceiptDate || null,
                amountReceived: formState.amountReceived,
                status: formState.status,
                notes: formState.notes || undefined,
              },
              "Conta a receber atualizada.",
            )
          }
          type="button"
        >
          Salvar ajuste
        </button>
        <button
          className="btn-secondary h-10"
          disabled={isPending}
          onClick={() =>
            patch(
              {
                status: "recebido",
              },
              "Conta marcada como recebida.",
            )
          }
          type="button"
        >
          Receber total
        </button>
        {receivable.originHref ? (
          <Link className="btn-secondary h-10" href={receivable.originHref}>
            Abrir origem
          </Link>
        ) : null}
      </div>

      {message ? <p className="text-xs text-black/55">{message}</p> : null}
    </div>
  );
}

export function PayableActions({ payable }: { payable: FinancialPayableItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    dueDate: payable.dueDate.slice(0, 10),
    actualPaymentDate: payable.actualPaymentDate?.slice(0, 10) ?? "",
    amountPaid: payable.amountPaid,
    notes: payable.notes ?? "",
    status: payable.status,
  });

  function patch(body: Record<string, unknown>, successMessage: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await clientApiRequest(`/financial/payables/${payable.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        <input
          className="input-soft h-10"
          type="date"
          value={formState.dueDate}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              dueDate: event.target.value,
            }))
          }
        />
        <input
          className="input-soft h-10"
          type="date"
          value={formState.actualPaymentDate}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              actualPaymentDate: event.target.value,
            }))
          }
        />
        <input
          className="input-soft h-10"
          inputMode="decimal"
          placeholder="Valor pago"
          value={formState.amountPaid}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              amountPaid: event.target.value,
            }))
          }
        />
        <select
          className="input-soft h-10"
          value={formState.status}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              status: event.target.value as FinancialPayableItem["status"],
            }))
          }
        >
          <option value="previsto">Previsto</option>
          <option value="pago_parcial">Pago parcial</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <button
          className="btn-primary h-10"
          disabled={isPending}
          onClick={() =>
            patch(
              {
                dueDate: formState.dueDate,
                actualPaymentDate: formState.actualPaymentDate || null,
                amountPaid: formState.amountPaid,
                status: formState.status,
                notes: formState.notes || undefined,
              },
              "Conta a pagar atualizada.",
            )
          }
          type="button"
        >
          Salvar ajuste
        </button>
        <button
          className="btn-secondary h-10"
          disabled={isPending}
          onClick={() =>
            patch(
              {
                status: "pago",
              },
              "Conta marcada como paga.",
            )
          }
          type="button"
        >
          Pagar total
        </button>
        {payable.originHref ? (
          <Link className="btn-secondary h-10" href={payable.originHref}>
            Abrir origem
          </Link>
        ) : null}
      </div>

      {message ? <p className="text-xs text-black/55">{message}</p> : null}
    </div>
  );
}

export function SettlementBatchActions({
  batch,
}: {
  batch: FinancialSettlementBatch;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    expectedReceiptDate: batch.expectedReceiptDate.slice(0, 10),
    actualReceiptDate: batch.actualReceiptDate?.slice(0, 10) ?? "",
    receivedAmount: batch.receivedAmount,
    status: batch.status,
    notes: batch.notes ?? "",
  });

  function patch(body: Record<string, unknown>, successMessage: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await clientApiRequest(`/financial/settlements/${batch.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        <input
          className="input-soft h-10"
          type="date"
          value={formState.expectedReceiptDate}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              expectedReceiptDate: event.target.value,
            }))
          }
        />
        <input
          className="input-soft h-10"
          type="date"
          value={formState.actualReceiptDate}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              actualReceiptDate: event.target.value,
            }))
          }
        />
        <input
          className="input-soft h-10"
          inputMode="decimal"
          placeholder="Valor recebido"
          value={formState.receivedAmount}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              receivedAmount: event.target.value,
            }))
          }
        />
        <select
          className="input-soft h-10"
          value={formState.status}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              status: event.target.value as FinancialSettlementBatch["status"],
            }))
          }
        >
          <option value="previsto">Previsto</option>
          <option value="recebido_parcial">Recebido parcial</option>
          <option value="recebido">Recebido</option>
          <option value="divergente">Divergente</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <button
          className="btn-primary h-10"
          disabled={isPending}
          onClick={() =>
            patch(
              {
                expectedReceiptDate: formState.expectedReceiptDate,
                actualReceiptDate: formState.actualReceiptDate || null,
                receivedAmount: formState.receivedAmount,
                status: formState.status,
                notes: formState.notes || undefined,
              },
              "Lote atualizado.",
            )
          }
          type="button"
        >
          Salvar lote
        </button>
        <button
          className="btn-secondary h-10"
          disabled={isPending}
          onClick={() =>
            patch(
              {
                status: "recebido",
              },
              "Lote marcado como recebido.",
            )
          }
          type="button"
        >
          Receber total
        </button>
      </div>

      {message ? <p className="text-xs text-black/55">{message}</p> : null}
    </div>
  );
}

export function GenerateIfoodBatchesAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        className="input-soft min-w-[220px]"
        placeholder="Observação do lote (opcional)"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const response = await clientApiRequest<FinancialSettlementBatch[]>(
                "/financial/settlements/ifood/generate",
                {
                  method: "POST",
                  body: JSON.stringify({
                    notes: notes || undefined,
                  }),
                },
              );
              setMessage(
                response.length > 0
                  ? `${response.length} lote(s) iFood gerado(s).`
                  : "Nenhum recebível iFood novo para agrupar.",
              );
              router.refresh();
            } catch (error) {
              setMessage(getErrorMessage(error));
            }
          });
        }}
        type="button"
      >
        Gerar lotes iFood
      </button>
      {message ? <p className="text-xs text-black/55">{message}</p> : null}
    </div>
  );
}

export function ChannelRuleActions({ rule }: { rule: FinancialChannelRule }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    settlementType: rule.settlementType,
    expectedSettlementRule: rule.expectedSettlementRule,
    expectedDays: rule.expectedDays?.toString() ?? "",
    feePct: rule.feePct ?? "",
    isActive: rule.isActive ? "true" : "false",
    notes: rule.notes ?? "",
  });

  const helperText = useMemo(() => {
    if (formState.expectedSettlementRule === "weekly_wednesday") {
      return "iFood padrão: próxima quarta-feira após a venda.";
    }

    if (formState.expectedSettlementRule === "days_after_sale") {
      return "Informe a quantidade de dias no campo ao lado.";
    }

    return "A regra pode ser ajustada manualmente a qualquer momento.";
  }, [formState.expectedSettlementRule]);

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        <select
          className="input-soft h-10"
          value={formState.settlementType}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              settlementType: event.target.value as FinancialChannelRule["settlementType"],
            }))
          }
        >
          <option value="immediate">Imediato</option>
          <option value="deferred">Diferido</option>
          <option value="marketplace_batch">Lote marketplace</option>
          <option value="manual">Manual</option>
        </select>
        <select
          className="input-soft h-10"
          value={formState.expectedSettlementRule}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              expectedSettlementRule:
                event.target.value as FinancialChannelRule["expectedSettlementRule"],
            }))
          }
        >
          <option value="same_day">Mesmo dia</option>
          <option value="next_day">Dia seguinte</option>
          <option value="weekly_wednesday">Quarta seguinte</option>
          <option value="days_after_sale">Dias após venda</option>
          <option value="manual">Manual</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input-soft h-10"
            inputMode="numeric"
            placeholder="Dias"
            value={formState.expectedDays}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                expectedDays: event.target.value,
              }))
            }
          />
          <input
            className="input-soft h-10"
            inputMode="decimal"
            placeholder="Taxa do canal"
            value={formState.feePct}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                feePct: event.target.value,
              }))
            }
          />
        </div>
        <select
          className="input-soft h-10"
          value={formState.isActive}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              isActive: event.target.value,
            }))
          }
        >
          <option value="true">Regra ativa</option>
          <option value="false">Regra inativa</option>
        </select>
      </div>

      <button
        className="btn-primary h-10"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              await clientApiRequest(`/financial/channel-rules/${rule.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  settlementType: formState.settlementType,
                  expectedSettlementRule: formState.expectedSettlementRule,
                  expectedDays:
                    formState.expectedDays.trim() === ""
                      ? null
                      : Number(formState.expectedDays),
                  feePct: formState.feePct.trim() === "" ? null : formState.feePct,
                  isActive: formState.isActive === "true",
                  notes: formState.notes || undefined,
                }),
              });
              setMessage("Regra financeira atualizada.");
              router.refresh();
            } catch (error) {
              setMessage(getErrorMessage(error));
            }
          });
        }}
        type="button"
      >
        Salvar regra
      </button>

      <p className="text-xs text-black/45">{helperText}</p>
      {message ? <p className="text-xs text-black/55">{message}</p> : null}
    </div>
  );
}
