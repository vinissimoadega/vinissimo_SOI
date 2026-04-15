"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4100/api/v1";

export function LogoutButton({
  compactOnMobile = false,
}: {
  compactOnMobile?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      startTransition(() => {
        router.push("/login");
        router.refresh();
      });
    }
  }

  return (
    <button
      aria-label="Sair da sessão"
      className="btn-secondary gap-2 px-3 sm:px-4"
      disabled={isPending}
      onClick={handleLogout}
      type="button"
    >
      <LogOut className="h-4 w-4" />
      <span className={compactOnMobile ? "hidden sm:inline" : undefined}>
        {isPending ? "Saindo..." : "Sair"}
      </span>
    </button>
  );
}
