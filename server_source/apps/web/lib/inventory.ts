import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  InventoryMinPricesResponse,
  InventoryMovementsResponse,
  InventoryStatusResponse,
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

export async function getInventoryStatus(
  query: URLSearchParams,
): Promise<InventoryStatusResponse> {
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return serverApiFetch<InventoryStatusResponse>(`/inventory/status${suffix}`);
}

export async function getInventoryMovements(
  query: URLSearchParams,
): Promise<InventoryMovementsResponse> {
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return serverApiFetch<InventoryMovementsResponse>(`/inventory/movements${suffix}`);
}

export async function getInventoryMinPrices(
  productId: string,
): Promise<InventoryMinPricesResponse> {
  return serverApiFetch<InventoryMinPricesResponse>(
    `/inventory/products/${productId}/min-prices`,
  );
}
