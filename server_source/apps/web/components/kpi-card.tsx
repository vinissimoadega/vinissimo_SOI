import { cn } from "./utils";

type Tone = "default" | "danger" | "success" | "warning";

const toneClasses: Record<Tone, string> = {
  default: "bg-white",
  danger: "bg-red-50",
  success: "bg-emerald-50",
  warning: "bg-amber-50",
};

export function KpiCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <article className={cn("surface p-4 sm:p-5", toneClasses[tone])}>
      <p className="text-xs text-black/55 sm:text-sm">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-grafite sm:text-2xl">
        {value}
      </p>
      {helper ? <p className="mt-2 text-xs text-black/45">{helper}</p> : null}
    </article>
  );
}
