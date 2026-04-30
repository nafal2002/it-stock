import { Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Terminal, LayoutDashboard, Boxes, ArrowLeftRight, LogOut, Loader2, History, Tag } from "lucide-react";

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const links = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/items", icon: Boxes, label: "Inventory" },
    { to: "/categories", icon: Tag, label: "Kategori" },
    { to: "/transactions", icon: ArrowLeftRight, label: "Transaksi" },
    { to: "/audit-logs", icon: History, label: "Audit Log" },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* sidebar */}
      <aside className="md:w-64 md:min-h-screen border-r border-border/50 bg-surface/50 backdrop-blur-sm">
        <div className="p-6 border-b border-border/50">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-lg font-bold">ITStock<span className="text-primary">.</span></span>
          </Link>
        </div>

        <nav className="p-4 space-y-1">
          {links.map((l) => {
            const active = loc.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="md:absolute md:bottom-0 md:w-64 p-4 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-2 truncate font-mono">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="w-full justify-start text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10">{children ?? <Outlet />}</main>
    </div>
  );
}
