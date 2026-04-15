import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  ProductCategoriesResponse,
  ProductChannelPricesResponse,
  ProductListItem,
  ProductListResponse,
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

export async function getProducts(
  query: URLSearchParams,
): Promise<ProductListResponse> {
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return serverApiFetch<ProductListResponse>(`/products${suffix}`);
}

export async function getProduct(productId: string): Promise<ProductListItem> {
  return serverApiFetch<ProductListItem>(`/products/${productId}`);
}

export async function getCategories(): Promise<ProductCategoriesResponse> {
  return serverApiFetch<ProductCategoriesResponse>("/categories");
}

export async function getProductChannelPrices(
  productId: string,
): Promise<ProductChannelPricesResponse> {
  return serverApiFetch<ProductChannelPricesResponse>(
    `/products/${productId}/channel-prices`,
  );
}
