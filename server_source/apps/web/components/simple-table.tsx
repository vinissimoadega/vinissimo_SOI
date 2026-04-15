import { cn } from "./utils";

export type SimpleTableColumn<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function SimpleTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = "Nenhum registro encontrado.",
}: {
  columns: SimpleTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  function renderCell(row: T, column: SimpleTableColumn<T>) {
    return column.render
      ? column.render(row)
      : String(row[column.key as keyof T] ?? "—");
  }

  return (
    <div className="table-shell">
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-black/45">{emptyMessage}</div>
      ) : (
        <>
          <div className="divide-y divide-black/5 md:hidden">
            {rows.map((row, index) => (
              <article
                key={String((row as { id?: string }).id ?? index)}
                className="space-y-3 p-4"
              >
                {columns.map((column) => (
                  <div
                    key={column.label}
                    className={cn("space-y-1", column.className)}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">
                      {column.label}
                    </p>
                    <div className="break-words text-sm text-grafite">
                      {renderCell(row, column)}
                    </div>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <table className="hidden min-w-full md:table">
            <thead className="table-head">
              <tr>
                {columns.map((column) => (
                  <th key={column.label} className="px-4 py-3">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String((row as { id?: string }).id ?? index)}>
                  {columns.map((column) => (
                    <td key={column.label} className={cn("table-cell", column.className)}>
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
