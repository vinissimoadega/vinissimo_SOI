import { SaleForm } from "@/components/sales/sale-form";
import { getSale, getSales } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: {
    saleId: string;
  };
}) {
  const [sale, salesResponse] = await Promise.all([
    getSale(params.saleId),
    getSales(new URLSearchParams("page=1&page_size=1")),
  ]);

  return (
    <SaleForm
      mode="edit"
      channels={salesResponse.meta.channels}
      customers={[]}
      marginMinTarget={salesResponse.meta.pricingPolicy.marginMinTarget}
      products={salesResponse.meta.products}
      sale={sale}
    />
  );
}
