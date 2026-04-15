import { PageTemplate } from "@/components/page-template";

const rows = [
  {
    "parametro": "Margem mínima",
    "valor": "35%"
  },
  {
    "parametro": "Lead time",
    "valor": "7 dias"
  },
  {
    "parametro": "Estoque de segurança",
    "valor": "5 dias"
  }
];

export default function Page() {
  return (
    <PageTemplate
      title="Configurações"
      description="Parâmetros correntes que sustentam o cálculo operacional do SOI."
      filters={
        <p className="text-sm leading-6 text-black/60">
          Configurações exibidas como referência operacional. O botão de salvar foi removido nesta auditoria porque ainda não havia formulário de edição publicado nesta tela.
        </p>
      }
      columns={[
        { key: "parametro", label: "Parâmetro" },
        { key: "valor", label: "Valor" },
      ]}
      rows={rows}
    />
  );
}
