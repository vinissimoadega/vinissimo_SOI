import { cn } from "./utils";

type BadgeTone =
  | "lead"
  | "novo"
  | "recorrente"
  | "inativo"
  | "ruptura"
  | "repor_agora"
  | "atencao"
  | "ok"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "warning"
  | "success";

const toneMap: Record<BadgeTone, string> = {
  lead: "bg-black/5 text-black/60",
  novo: "bg-sky-100 text-sky-700",
  recorrente: "bg-emerald-100 text-emerald-700",
  inativo: "bg-amber-100 text-amber-700",
  ruptura: "bg-red-100 text-red-700",
  repor_agora: "bg-amber-100 text-amber-700",
  atencao: "bg-yellow-100 text-yellow-700",
  ok: "bg-emerald-100 text-emerald-700",
  critical: "bg-red-100 text-red-700",
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        toneMap[tone],
      )}
    >
      {label}
    </span>
  );
}
