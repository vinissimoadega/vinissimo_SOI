import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { SimpleTable } from "@/components/simple-table";
import { getInventoryMinPrices } from "@/lib/inventory";
import type { InventoryMinPriceRow } from "@/types";

export const dynamic = "force-dynamic";

type InventoryMinPricesPageProps = {
  params: {
    productId: string;
  };
};

function formatCurrency(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatPct(value: string) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export default async function InventoryMinPricesPage({
  params,
}: InventoryMinPricesPageProps) {
  const response = await getInventoryMinPrices(params.productId);

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Preço mínimo por canal</h1>
          <p className="mt-2 text-sm text-black/55">
            Referência operacional calculada a partir do custo atual, taxa por canal e margem mínima vigente.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/inventory">
            Voltar ao estoque
          </Link>
          <Link className="btn-primary" href={`/inventory/movements?product_id=${response.productId}`}>
            Ver movimentos do produto
          </Link>
        </div>
      </header>

      <SectionCard
        title={`${response.sku} · ${response.name}`}
        subtitle="Leitura de preço mínimo por canal para apoiar decisão comercial e reposição."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="surface-soft p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Custo operacional atual</p>
            <p className="mt-2 text-2xl font-semibold text-vinho-950">
              {formatCurrency(response.currentUnitCost)}
            </p>
          </div>
          <div className="surface-soft p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Margem mínima</p>
            <p className="mt-2 text-2xl font-semibold text-vinho-950">
              {formatPct(response.marginMinTarget)}
            </p>
          </div>
          <div className="surface-soft p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-black/45">Uso esperado</p>
            <p className="mt-2 text-sm text-black/60">
              O preço mínimo resultante já considera taxa do canal e a margem mínima corrente.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Matriz mínima por canal"
        subtitle="Use esta leitura como piso operacional antes de desconto manual fora da política do canal."
      >
        <SimpleTable<InventoryMinPriceRow>
          columns={[
            { key: "channelName", label: "Canal" },
            {
              key: "feePct",
              label: "Taxa do canal",
              render: (row) => formatPct(row.feePct),
            },
            {
              key: "marginMinTarget",
              label: "Margem mínima",
              render: (row) => formatPct(row.marginMinTarget),
            },
            {
              key: "minimumPrice",
              label: "Preço mínimo",
              render: (row) => formatCurrency(row.minimumPrice),
            },
          ]}
          rows={response.prices}
        />
      </SectionCard>
    </div>
  );
}
