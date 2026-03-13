import { redirect } from "next/navigation";

import AppHeader from "@/components/dashboard/app-header";
import AppSidebar from "@/components/dashboard/app-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AppSidebar />

      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader email={user.email ?? "admin"} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}