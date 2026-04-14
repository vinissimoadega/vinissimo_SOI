import { ProductForm } from "@/components/products/product-form";
import { getCategories } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const categories = await getCategories();
  const initialSku = Array.isArray(searchParams?.sku)
    ? searchParams?.sku[0] ?? null
    : searchParams?.sku ?? null;

  return (
    <ProductForm
      categories={categories.items}
      initialSku={initialSku}
      mode="create"
    />
  );
}
