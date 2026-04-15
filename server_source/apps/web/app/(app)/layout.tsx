import { requireCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireCurrentUser();

  return <AppShell user={user}>{children}</AppShell>;
}
