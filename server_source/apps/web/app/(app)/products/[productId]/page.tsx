import { ChannelPricesForm } from "@/components/products/channel-prices-form";
import { ProductForm } from "@/components/products/product-form";
import { getCategories, getProduct, getProductChannelPrices } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: {
    productId: string;
  };
}) {
  const [product, categories, channelPrices] = await Promise.all([
    getProduct(params.productId),
    getCategories(),
    getProductChannelPrices(params.productId),
  ]);

  return (
    <div className="space-y-6">
      <ProductForm categories={categories.items} mode="edit" product={product} />
      <ChannelPricesForm productId={product.id} prices={channelPrices.prices} />
    </div>
  );
}
