import type { CurrentSettings, HealthResponse } from "@/types";
import {
  fallbackAlerts,
  fallbackChannelPerformance,
  fallbackCustomerAttention,
  fallbackKpis,
  fallbackStockCritical,
} from "./mock";

function getApiBaseUrl(): string {
  const internalBaseUrl =
    process.env.API_INTERNAL_BASE_URL || "http://api:4100/api/v1";

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4100/api/v1";

  return typeof window === "undefined" ? internalBaseUrl : publicBaseUrl;
}

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getHealth(): Promise<HealthResponse | null> {
  return safeFetch<HealthResponse>("/health");
}

export async function getCurrentSettings(): Promise<CurrentSettings | null> {
  return safeFetch<CurrentSettings>("/settings/current");
}

export async function getDashboardBootstrapData() {
  const [health, settings] = await Promise.all([
    getHealth(),
    getCurrentSettings(),
  ]);

  return {
    health,
    settings,
    kpis: fallbackKpis,
    alerts: fallbackAlerts,
    channelPerformance: fallbackChannelPerformance,
    stockCritical: fallbackStockCritical,
    customerAttention: fallbackCustomerAttention,
  };
}
