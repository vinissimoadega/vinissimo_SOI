"use client";

export class ApiRequestError<TPayload = unknown> extends Error {
  status: number;
  payload: TPayload | null;

  constructor(message: string, status: number, payload: TPayload | null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function getPublicApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4100/api/v1";
}

export async function clientApiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getPublicApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string" &&
        payload.message) ||
      "Não foi possível concluir a ação.";

    throw new ApiRequestError(message, response.status, payload);
  }

  return payload as T;
}
