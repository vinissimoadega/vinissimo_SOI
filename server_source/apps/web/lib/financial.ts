import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  FinancialCashflowResponse,
  FinancialOverviewResponse,
  FinancialPayablesResponse,
  FinancialPnlResponse,
  FinancialReceivablesResponse,
  FinancialSettlementsResponse,
} from "@/types";

function getInternalApiBaseUrl() {
  return process.env.API_INTERNAL_BASE_URL || "http://api:4100/api/v1";
}

async function serverApiFetch<T>(path: string): Promise<T> {
  const cookieHeader = headers().get("cookie");

  const response = await fetch(`${getInternalApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

  if (response.status === 401) {
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(`Falha ao buscar ${path}`);
  }

  return (await response.json()) as T;
}

function withQuery(path: string, query?: URLSearchParams | string) {
  const serialized =
    typeof query === "string" ? query : query?.toString() ?? "";

  if (!serialized) {
    return path;
  }

  return `${path}?${serialized}`;
}

export function getFinancialOverview() {
  return serverApiFetch<FinancialOverviewResponse>("/financial/overview");
}

export function getFinancialReceivables(query?: URLSearchParams | string) {
  return serverApiFetch<FinancialReceivablesResponse>(
    withQuery("/financial/receivables", query),
  );
}

export function getFinancialPayables(query?: URLSearchParams | string) {
  return serverApiFetch<FinancialPayablesResponse>(
    withQuery("/financial/payables", query),
  );
}

export function getFinancialCashflow(query?: URLSearchParams | string) {
  return serverApiFetch<FinancialCashflowResponse>(
    withQuery("/financial/cashflow", query),
  );
}

export function getFinancialPnl(query?: URLSearchParams | string) {
  return serverApiFetch<FinancialPnlResponse>(withQuery("/financial/pnl", query));
}

export function getFinancialSettlements(query?: URLSearchParams | string) {
  return serverApiFetch<FinancialSettlementsResponse>(
    withQuery("/financial/settlements", query),
  );
}
