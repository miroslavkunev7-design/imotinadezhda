import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Building2, LayoutDashboard, LogOut, MapPin, MessageSquare, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user, loading, navigate]);

  if (loading || isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Зареждане...</div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-accent-foreground">Нямате достъп</h1>
          <p className="mt-2 text-sm text-muted-foreground">Този раздел е само за администратори.</p>
          <button onClick={() => signOut().then(() => navigate({ to: "/login" }))} className="mt-4 text-sm text-primary underline">Изход</button>
        </div>
      </div>
    );
  }

  const nav = [
    { to: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
    { to: "/admin/properties", label: "Имоти", icon: Building2 },
    { to: "/admin/inquiries", label: "Запитвания", icon: MessageSquare },
    { to: "/admin/ai", label: "AI Помощник", icon: Sparkles },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r border-primary/15 bg-card p-6">
        <Link to="/" className="font-display text-2xl text-primary">ИЛДЖ.ИА</Link>
        <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Админ панел</p>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          className="mt-8 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" /> Изход
        </button>
        <p className="mt-4 truncate text-xs text-muted-foreground">{user.email}</p>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
