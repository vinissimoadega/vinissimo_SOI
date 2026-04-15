import { PurchaseForm } from "@/components/purchases/purchase-form";
import { getPurchases } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const purchasesResponse = await getPurchases(new URLSearchParams("page=1&page_size=1"));

  return (
    <PurchaseForm
      mode="create"
      products={purchasesResponse.meta.products}
      suppliers={purchasesResponse.meta.suppliers}
    />
  );
}
