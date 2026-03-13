"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Overview",
    href: "/dashboard",
  },
  {
    title: "Upload Data",
    href: "/dashboard/upload",
  },
  {
    title: "Documents",
    href: "/dashboard/documents",
  },
  {
    title: "Activity Logs",
    href: "/dashboard/activity-logs",
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r bg-background md:block">
      <div className="flex h-16 items-center px-6">
        <div>
          <p className="text-lg font-semibold">RSU Admin</p>
          <p className="text-xs text-muted-foreground">Knowledge Base Panel</p>
        </div>
      </div>

      <Separator />

      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}