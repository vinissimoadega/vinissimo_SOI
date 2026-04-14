import { ProductForm } from "@/components/products/product-form";
import { getCategories } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await getCategories();

  return <ProductForm categories={categories.items} mode="create" />;
}
