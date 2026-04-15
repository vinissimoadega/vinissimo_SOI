import Link from "next/link";
import { SectionCard } from "./section-card";
import { SimpleTable, type SimpleTableColumn } from "./simple-table";

export function PageTemplate<T extends Record<string, unknown>>({
  title,
  description,
  ctaLabel,
  ctaHref,
  filters,
  columns,
  rows,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  filters?: React.ReactNode;
  columns: SimpleTableColumn<T>[];
  rows: T[];
}) {
  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="mt-2 text-sm text-black/55">{description}</p>
        </div>
        {ctaLabel ? (
          <div className="page-header-actions">
            {ctaHref ? (
              <Link className="btn-primary" href={ctaHref}>
                {ctaLabel}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="btn-secondary cursor-not-allowed opacity-70"
                title="Ação ainda não publicada nesta tela."
              >
                {ctaLabel}
              </span>
            )}
          </div>
        ) : null}
      </header>

      <SectionCard
        title="Filtros"
        subtitle={filters ? "Controles publicados para esta tela." : "Leitura atual da superfície. Sem filtros publicados nesta tela."}
      >
        {filters ?? (
          <p className="text-sm text-black/55">
            Esta tela não possui ação ou filtro editável publicado nesta versão. Use os módulos operacionais do menu para criar, filtrar e atualizar registros.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Lista" subtitle="Tabela-base para o módulo.">
        <SimpleTable columns={columns} rows={rows} />
      </SectionCard>
    </div>
  );
}
