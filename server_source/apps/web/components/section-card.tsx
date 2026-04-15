import { cn } from "./utils";

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface overflow-hidden", className)}>
      <header className="flex flex-col gap-3 border-b border-black/5 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="space-y-1">
          <h3>{title}</h3>
          {subtitle ? (
            <p className="text-sm text-black/55">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
