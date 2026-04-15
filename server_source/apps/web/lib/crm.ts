import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  CrmCustomerMemoryResponse,
  CrmOverviewResponse,
  CrmQueueResponse,
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

export async function getCrmOverview() {
  return serverApiFetch<CrmOverviewResponse>("/crm/overview");
}

export async function getCrmQueue(query: URLSearchParams) {
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return serverApiFetch<CrmQueueResponse>(`/crm/queue${suffix}`);
}

export async function getCrmCustomerMemory(customerId: string) {
  return serverApiFetch<CrmCustomerMemoryResponse>(
    `/crm/customers/${customerId}/memory`,
  );
}
