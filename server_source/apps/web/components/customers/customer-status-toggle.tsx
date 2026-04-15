"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApiRequest } from "@/lib/client-api";

export function CustomerStatusToggle({
  customerId,
  isActive,
}: {
  customerId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleToggle() {
    setIsPending(true);

    try {
      await clientApiRequest(`/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !isActive }),
      });
      startTransition(() => router.refresh());
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      className="btn-secondary h-9 px-3"
      disabled={isPending}
      onClick={handleToggle}
      type="button"
    >
      {isPending ? "Atualizando..." : isActive ? "Inativar" : "Ativar"}
    </button>
  );
}
