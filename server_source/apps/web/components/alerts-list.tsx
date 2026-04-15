import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { AlertItem } from "@/types";
import { StatusBadge } from "./status-badge";

export function AlertsList({ items }: { items: AlertItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="block rounded-xl border border-black/5 bg-white p-4 transition hover:border-vinho-900/20 hover:bg-vinho-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-vinho-50 p-2 text-vinho-900">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-grafite">{item.title}</p>
                <p className="text-sm text-black/55">{item.message}</p>
                <p className="text-xs text-black/40">Origem: {item.entity}</p>
              </div>
            </div>
            <StatusBadge label={item.severity} tone={item.severity} />
          </div>
        </Link>
      ))}
    </div>
  );
}
