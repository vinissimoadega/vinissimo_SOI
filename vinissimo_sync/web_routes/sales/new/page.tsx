import { SaleForm } from "@/components/sales/sale-form";
import { getSales } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const salesResponse = await getSales(new URLSearchParams("page=1&page_size=1"));

  return (
    <SaleForm
      mode="create"
      channels={salesResponse.meta.channels}
      customers={[]}
      marginMinTarget={salesResponse.meta.pricingPolicy.marginMinTarget}
      products={salesResponse.meta.products}
    />
  );
}
