import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { checkAdminAccess, logAdminAccess } from "@/lib/audit.functions";
import { supabase } from "@/integrations/supabase/client";

const withTimeout = <T,>(promise: Promise<T>, ms = 6000): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

/**
 * Връща валидна сесия с access_token. Ако токенът е изтекъл или близо до изтичане
 * (по-малко от 60s), прави refresh. Ако няма сесия или refresh се провали - връща null.
 */
async function ensureFreshSession(): Promise<string | null> {
  try {
    // 1) Вземи текущата сесия от storage
    const sessData = await withTimeout(supabase.auth.getSession());
    if (!sessData) return null;
    let session = sessData.session;

    const nowSec = () => Math.floor(Date.now() / 1000);
    const isExpiring = (s: typeof session) =>
      !s?.access_token || (s.expires_at ?? 0) - nowSec() < 60;

    // 2) Ако липсва/изтекла/близо до изтичане - опитай refresh
    if (isExpiring(session)) {
      const { data: refreshed, error: refreshErr } =
        await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session?.access_token) {
        // refresh token е невалиден -> излез чисто
        await supabase.auth.signOut().catch(() => {});
        return null;
      }
      session = refreshed.session;
    }

    // 3) Финална ре-валидация срещу Auth сървъра
    const userResult = await withTimeout(supabase.auth.getUser());
    if (!userResult) return null;
    const { data: userData, error: userErr } = userResult;
    if (userErr || !userData.user) {
      await supabase.auth.signOut().catch(() => {});
      return null;
    }

    return session?.access_token ?? null;
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
        if (cancelled) return;
        setIsAdmin(isAdmin);
        if (isAdmin) {
          logAdminAccess({ data: { path: "/admin" } }).catch(() => {});
        }
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
      <div className="flex min-h-screen items-center justify-center bg-[#5e0f1d] text-amber-100/70">
        Зареждане...
      </div>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#5e0f1d] px-4">
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
