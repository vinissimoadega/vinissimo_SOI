import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { WhatsappQuickOrder } from "@/components/sales/whatsapp-quick-order";
import { getSales } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function WhatsappQuickOrderPage() {
  const salesResponse = await getSales(new URLSearchParams("page=1&page_size=1"));
  const whatsappChannel =
    salesResponse.meta.channels.find((channel) => channel.channelKey === "whatsapp") ??
    salesResponse.meta.channels[0];

  if (!whatsappChannel) {
    throw new Error("Nenhum canal ativo disponível para o fluxo de WhatsApp.");
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>Venda rápida WhatsApp</h1>
          <p className="mt-2 text-sm text-black/55">
            Fluxo mínimo para localizar o cliente por telefone, criar pedido com poucos cliques e gerar mensagem pronta para envio.
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn-secondary" href="/sales">
            Voltar para vendas
          </Link>
          <Link className="btn-primary" href="/sales/new">
            Venda completa
          </Link>
        </div>
      </header>

      <SectionCard
        title="Regra desta rodada"
        subtitle="O pagamento é tratado separadamente do pedido. Não há Pix automático nem confirmação automática."
      >
        <p className="text-sm text-black/60">
          Use este fluxo para acelerar pedidos que chegam pelo WhatsApp. O pedido nasce com número automático, status do pedido separado do status de pagamento e texto profissional pronto para copiar.
        </p>
      </SectionCard>

      <WhatsappQuickOrder
        products={salesResponse.meta.products}
        whatsappChannel={whatsappChannel}
      />
    </div>
  );
}
