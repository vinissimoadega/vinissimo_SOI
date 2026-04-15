import type { AuthUser } from "@/types";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthUser;
}) {
  return (
    <div className="min-h-screen bg-[#fbf8f5] text-grafite">
      <div className="flex min-h-screen">
        <SidebarNav />
        <div className="min-w-0 flex-1">
          <Topbar user={user} />
          <main className="px-3 py-4 sm:px-4 sm:py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
