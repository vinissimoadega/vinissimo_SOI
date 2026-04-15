import { clientApiRequest } from "@/lib/client-api";
import type { ProductSkuLookupResponse } from "@/types";

export function normalizeSkuValue(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export async function lookupProductBySku(rawSku: string) {
  const sku = normalizeSkuValue(rawSku);
  const query = new URLSearchParams({ sku });
  return clientApiRequest<ProductSkuLookupResponse>(
    `/products/lookup/by-sku?${query.toString()}`,
  );
}
