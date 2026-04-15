import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerPreferencesForm } from "@/components/customers/customer-preferences-form";
import { CrmTaskManager } from "@/components/crm/crm-task-manager";
import { CustomerMemoryCard } from "@/components/crm/customer-memory-card";
import { getCustomer, getCustomers, getCustomerPreferences } from "@/lib/customers";
import { getCrmCustomerMemory, getCrmOverview } from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: {
    customerId: string;
  };
}) {
  const [customer, memory, preferences, customersResponse, crmOverview] =
    await Promise.all([
      getCustomer(params.customerId),
      getCrmCustomerMemory(params.customerId),
      getCustomerPreferences(params.customerId),
      getCustomers(new URLSearchParams("page=1&page_size=1")),
      getCrmOverview(),
    ]);

  return (
    <div className="space-y-6">
      <CustomerForm
        channels={customersResponse.meta.channels}
        customer={customer}
        mode="edit"
      />
      <CustomerMemoryCard memory={memory} />
      <CustomerPreferencesForm
        customerId={memory.customer.id}
        preferences={preferences.items}
      />
      <CrmTaskManager
        customerOptions={crmOverview.meta.customers}
        emptyMessage="Nenhuma ação operacional registrada para este cliente."
        initialTasks={memory.recentTasks}
        lockedCustomerId={memory.customer.id}
        lockedCustomerLabel={memory.customer.fullName}
        salesOptions={crmOverview.meta.sales.filter(
          (sale) => sale.customerId === memory.customer.id,
        )}
        subtitle="Registre pós-venda, avaliação, reativação e ações manuais vinculadas a este cliente."
        title="Ações de relacionamento"
      />
    </div>
  );
}
