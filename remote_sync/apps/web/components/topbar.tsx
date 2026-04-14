"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Menu,
  Search,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import type { AuthUser } from "@/types";
import { LogoutButton } from "./logout-button";
import { MobileSidebarNav } from "./sidebar-nav";

function formatRoleLabel(roleKey: string | undefined) {
  switch (roleKey) {
    case "admin":
      return "Admin";
    case "operacao":
      return "Operação";
    case "comercial":
      return "Comercial";
    case "crm":
      return "CRM";
    case "financeiro":
      return "Financeiro";
    default:
      return "Autenticado";
  }
}

export function Topbar({ user }: { user: AuthUser }) {
  const primaryRole = formatRoleLabel(user.roles[0]);
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#fbf8f5]/95 backdrop-blur">
        <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                aria-label="Abrir navegação"
                className="btn-secondary h-11 w-11 shrink-0 p-0 lg:hidden"
                data-mobile-nav-trigger="true"
                onClick={() => setMobileNavOpen(true)}
                type="button"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="min-w-0 lg:hidden">
                <p className="text-[11px] uppercase tracking-[0.22em] text-black/45">
                  Viníssimo
                </p>
                <p className="mt-1 text-base font-semibold text-vinho-900">SOI</p>
              </div>

              <form action="/products" className="relative hidden min-w-[260px] xl:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                <input
                  aria-label="Buscar produtos"
                  className="input-soft w-full pl-9"
                  name="search"
                  placeholder="Buscar vinho, SKU, país, região ou uvas"
                />
              </form>
            </div>

            <div className="flex items-center gap-2">
              <div
                aria-label="Escopo temporal: mês atual"
                className="hidden md:inline-flex btn-secondary gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Mês atual
              </div>

              <div className="hidden sm:inline-flex btn-secondary gap-2">
                <ShieldCheck className="h-4 w-4" />
                {primaryRole}
              </div>

              <div className="hidden md:flex btn-secondary gap-3">
                <UserCircle2 className="h-4 w-4" />
                <div className="text-left leading-tight">
                  <p className="text-sm font-medium text-grafite">{user.fullName}</p>
                  <p className="text-xs text-black/45">{user.email}</p>
                </div>
              </div>

              <LogoutButton compactOnMobile />
            </div>
          </div>

          <form action="/products" className="relative xl:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              aria-label="Buscar produtos"
              className="input-soft w-full pl-9"
              name="search"
              placeholder="Buscar vinho, SKU, país, região ou uvas"
            />
          </form>
        </div>
      </header>

      <MobileSidebarNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </>
  );
}
