import { StatusBadge } from "@/components/status-badge";
import type {
  FinancialPayableStatus,
  FinancialReceivableStatus,
  FinancialSettlementBatchStatus,
  FinancialSettlementRule,
  FinancialSettlementType,
} from "@/types";

export function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

export function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPct(value: string | number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function formatSettlementType(value: FinancialSettlementType) {
  switch (value) {
    case "immediate":
      return "Imediato";
    case "deferred":
      return "Diferido";
    case "marketplace_batch":
      return "Lote marketplace";
    default:
      return "Manual";
  }
}

export function formatSettlementRule(value: FinancialSettlementRule) {
  switch (value) {
    case "same_day":
      return "Mesmo dia";
    case "next_day":
      return "Dia seguinte";
    case "weekly_wednesday":
      return "Quarta seguinte";
    case "days_after_sale":
      return "Dias após venda";
    default:
      return "Manual";
  }
}

export function FinancialReceivableStatusBadge({
  status,
}: {
  status: FinancialReceivableStatus;
}) {
  const ui = getReceivableStatusUi(status);
  return <StatusBadge label={ui.label} tone={ui.tone} />;
}

export function FinancialPayableStatusBadge({
  status,
}: {
  status: FinancialPayableStatus;
}) {
  const ui = getPayableStatusUi(status);
  return <StatusBadge label={ui.label} tone={ui.tone} />;
}

export function FinancialSettlementStatusBadge({
  status,
}: {
  status: FinancialSettlementBatchStatus;
}) {
  const ui = getSettlementStatusUi(status);
  return <StatusBadge label={ui.label} tone={ui.tone} />;
}

export function formatReceivableStatus(status: FinancialReceivableStatus) {
  return getReceivableStatusUi(status).label;
}

export function formatPayableStatus(status: FinancialPayableStatus) {
  return getPayableStatusUi(status).label;
}

export function formatSettlementStatus(status: FinancialSettlementBatchStatus) {
  return getSettlementStatusUi(status).label;
}

function getReceivableStatusUi(status: FinancialReceivableStatus) {
  switch (status) {
    case "recebido":
      return { label: "Recebido", tone: "success" as const };
    case "recebido_parcial":
      return { label: "Recebido parcial", tone: "warning" as const };
    case "vencido":
      return { label: "Vencido", tone: "high" as const };
    case "vencendo_hoje":
      return { label: "Vence hoje", tone: "warning" as const };
    case "cancelado":
      return { label: "Cancelado", tone: "low" as const };
    default:
      return { label: "Previsto", tone: "low" as const };
  }
}

function getPayableStatusUi(status: FinancialPayableStatus) {
  switch (status) {
    case "pago":
      return { label: "Pago", tone: "success" as const };
    case "pago_parcial":
      return { label: "Pago parcial", tone: "warning" as const };
    case "vencido":
      return { label: "Vencido", tone: "high" as const };
    case "vencendo_hoje":
      return { label: "Vence hoje", tone: "warning" as const };
    case "cancelado":
      return { label: "Cancelado", tone: "low" as const };
    default:
      return { label: "Previsto", tone: "low" as const };
  }
}

function getSettlementStatusUi(status: FinancialSettlementBatchStatus) {
  switch (status) {
    case "recebido":
      return { label: "Recebido", tone: "success" as const };
    case "recebido_parcial":
      return { label: "Recebido parcial", tone: "warning" as const };
    case "divergente":
      return { label: "Divergente", tone: "high" as const };
    case "cancelado":
      return { label: "Cancelado", tone: "low" as const };
    default:
      return { label: "Previsto", tone: "low" as const };
  }
}
