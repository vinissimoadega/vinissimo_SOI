import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser } from "@/types";

export const AUTH_COOKIE_NAME = "vinissimo_soi_session";

function getInternalApiBaseUrl(): string {
  return process.env.API_INTERNAL_BASE_URL || "http://api:4100/api/v1";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieHeader = headers().get("cookie");

  if (!cookieHeader?.includes(`${AUTH_COOKIE_NAME}=`)) {
    return null;
  }

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/auth/me`, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }
}
