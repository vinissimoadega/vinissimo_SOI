"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { navigation } from "@/lib/navigation";
import { cn } from "./utils";

function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-xs uppercase tracking-[0.24em] text-white/50">
          Viníssimo
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">SOI</h2>
        <p className="mt-2 text-sm text-white/65">
          Sistema Operacional Inteligente
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href === "/financial/overview" && pathname.startsWith("/financial"));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4 text-xs text-white/45">
        Ambiente local / bootstrap inicial
      </div>
    </>
  );
}

export function SidebarNav() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-black/5 bg-vinho-950 text-white lg:flex lg:flex-col">
      <SidebarNavContent />
    </aside>
  );
}

export function MobileSidebarNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-40 lg:hidden",
        open ? "" : "pointer-events-none",
      )}
    >
      <button
        aria-label="Fechar navegação"
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        type="button"
      />

      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-vinho-950 text-white shadow-2xl transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/50">
              Viníssimo
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">SOI</h2>
          </div>
          <button
            aria-label="Fechar navegação"
            className="btn-secondary h-11 w-11 border-white/10 bg-white/5 p-0 text-white hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <SidebarNavContent onNavigate={onClose} />
      </aside>
    </div>
  );
}
