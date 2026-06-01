import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { checkAdminAccess, logAdminAccess } from "@/lib/audit.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

/**
 * Връща валидна сесия с access_token. Ако токенът е изтекъл или близо до изтичане
 * (по-малко от 60s), прави refresh. Ако няма сесия или refresh се провали - връща null.
 */
async function ensureFreshSession(): Promise<string | null> {
  try {
    // 1) getUser() ре-валидира JWT срещу Auth сървъра - надеждно за hydration
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return null;

    const { data: sessData } = await supabase.auth.getSession();
    const session = sessData.session;
    if (!session?.access_token) return null;

    const expiresAt = session.expires_at ?? 0; // секунди от epoch
    const nowSec = Math.floor(Date.now() / 1000);
    const remaining = expiresAt - nowSec;

    // 2) Ако остават по-малко от 60s - refresh
    if (remaining < 60) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session?.access_token) return null;
      return refreshed.session.access_token;
    }

    return session.access_token;
  } catch (e) {
    console.error("ensureFreshSession failed", e);
    return null;
  }
}

function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const token = await ensureFreshSession();
      if (cancelled || !token) return;
      try {
        await logAdminAccess({ data: { path: "/admin" } });
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await ensureFreshSession();
      if (cancelled) return;
      if (!token) {
        navigate({ to: "/login" });
        return;
      }
      try {
        const { isAdmin } = await checkAdminAccess();
        if (!cancelled) setIsAdmin(isAdmin);
      } catch (error) {
        console.error("admin access check failed", error);
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
