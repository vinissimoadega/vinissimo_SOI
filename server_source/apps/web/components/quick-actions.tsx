import Link from "next/link";
import { Plus, Receipt, ShoppingCart, UserPlus } from "lucide-react";

const actions = [
  { href: "/sales", label: "Nova venda", icon: ShoppingCart },
  { href: "/purchases", label: "Nova compra", icon: Plus },
  { href: "/customers", label: "Novo cliente", icon: UserPlus },
  { href: "/expenses", label: "Nova despesa", icon: Receipt },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            href={action.href}
            className="surface flex items-center gap-3 p-4 transition hover:border-vinho-900/20 hover:bg-vinho-50"
          >
            <div className="rounded-xl bg-vinho-900 p-2 text-white">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-grafite">{action.label}</p>
              <p className="text-xs text-black/45">Ação rápida do fluxo diário</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
