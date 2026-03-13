import LogoutButton from "@/components/dashboard/logout-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type AppHeaderProps = {
  email: string;
};

export default function AppHeader({ email }: AppHeaderProps) {
  const fallback = email?.slice(0, 2).toUpperCase() || "AD";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <h1 className="text-lg font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Manage knowledge files and ingestion pipeline
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">Administrator</p>
        </div>

        <Avatar>
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>

        <LogoutButton />
      </div>
    </header>
  );
}