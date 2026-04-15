import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomers } from "@/lib/customers";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const customers = await getCustomers(new URLSearchParams("page=1&page_size=1"));

  return (
    <CustomerForm channels={customers.meta.channels} mode="create" />
  );
}
