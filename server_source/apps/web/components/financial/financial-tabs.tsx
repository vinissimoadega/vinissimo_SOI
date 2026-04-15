"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/utils";

const tabs = [
  { href: "/financial/overview", label: "Visão geral" },
  { href: "/financial/receivables", label: "Contas a receber" },
  { href: "/financial/payables", label: "Contas a pagar" },
  { href: "/financial/cashflow", label: "Fluxo de caixa" },
  { href: "/financial/pnl", label: "DRE simplificada" },
  { href: "/financial/settlements", label: "Repasses" },
] as const;

export function FinancialTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
              active
                ? "border-vinho-900 bg-vinho-900 text-white"
                : "border-black/10 bg-white text-grafite hover:border-vinho-200 hover:bg-vinho-50",
            )}
            href={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
