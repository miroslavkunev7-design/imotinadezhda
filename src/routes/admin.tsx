import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { checkAdminAccess, logAdminAccess } from "@/lib/audit.functions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    logAdminAccess({
      data: { path: "/admin", userId: user?.id ?? null, email: user?.email ?? null },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    checkAdminAccess()
      .then(({ isAdmin }) => setIsAdmin(isAdmin))
      .catch((error) => {
        console.error("admin access check failed", error);
        setIsAdmin(false);
      });
  }, [user, loading, navigate]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a0608] text-amber-100/70">
        Зареждане...
      </div>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a0608] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-amber-100">Нямате достъп</h1>
          <p className="mt-2 text-sm text-amber-100/60">Този раздел е само за администратори.</p>
          <button
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
            className="mt-4 text-sm text-amber-300 underline"
          >
            Изход
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
