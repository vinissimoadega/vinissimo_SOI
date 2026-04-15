"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApiRequest } from "@/lib/client-api";

export function ProductStatusToggle({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const nextLabel = isActive ? "Inativar" : "Ativar";

  async function handleClick() {
    setIsPending(true);

    try {
      await clientApiRequest(`/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !isActive,
        }),
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
      onClick={handleClick}
      type="button"
    >
      {isPending ? "Salvando..." : nextLabel}
    </button>
  );
}
