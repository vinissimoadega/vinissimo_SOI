import { PageTemplate } from "@/components/page-template";

const rows = [
  {
    "data": "01/04/2026",
    "titulo": "Bootstrap isolado no 209",
    "responsavel": "Direção",
    "revisar": "15/04/2026"
  }
];

export default function Page() {
  return (
    <PageTemplate
      title="Decisões"
      description="Registro executivo de mudanças e direções do sistema."
      columns={[
        { key: "data", label: "Data" },
        { key: "titulo", label: "Título" },
        { key: "responsavel", label: "Responsável" },
        { key: "revisar", label: "Revisar em" },
      ]}
      rows={rows}
    />
  );
}
