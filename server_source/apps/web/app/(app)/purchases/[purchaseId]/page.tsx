import { PurchaseForm } from "@/components/purchases/purchase-form";
import { getPurchase, getPurchases } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({
  params,
}: {
  params: {
    purchaseId: string;
  };
}) {
  const [purchase, purchasesResponse] = await Promise.all([
    getPurchase(params.purchaseId),
    getPurchases(new URLSearchParams("page=1&page_size=1")),
  ]);

  return (
    <PurchaseForm
      mode="edit"
      products={purchasesResponse.meta.products}
      purchase={purchase}
      suppliers={purchasesResponse.meta.suppliers}
    />
  );
}
