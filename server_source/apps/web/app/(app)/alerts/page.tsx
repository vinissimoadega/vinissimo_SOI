import { PageTemplate } from "@/components/page-template";
import { StatusBadge } from "@/components/status-badge";

const rows = [
  {
    "tipo": "stock_rupture",
    "severidade": "high",
    "entidade": "Produto",
    "status": "open"
  },
  {
    "tipo": "customer_inactive",
    "severidade": "medium",
    "entidade": "Cliente",
    "status": "acknowledged"
  }
];

export default function Page() {
  return (
    <PageTemplate
      title="Alertas"
      description="Superfície de ação do sistema com severidade e origem."
      columns={[
        { key: "tipo", label: "Tipo" },
        { key: "severidade", label: "Severidade", render: (row) => <StatusBadge label={String(row.severidade)} tone={row.severidade as "critical" | "high" | "medium" | "low"} /> },
        { key: "entidade", label: "Entidade" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
    />
  );
}
