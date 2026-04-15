import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ExpenseListResponse } from "@/types";

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

export async function getExpenses(query: URLSearchParams): Promise<ExpenseListResponse> {
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return serverApiFetch<ExpenseListResponse>(`/expenses${suffix}`);
}
