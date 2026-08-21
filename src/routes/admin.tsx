import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { checkAdminAccess, logAdminAccess } from "@/lib/audit.functions";
import { supabase } from "@/integrations/supabase/client";

const withTimeout = <T,>(promise: Promise<T>, ms = 12000): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function hasOAuthReturn() {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.has("code") || q.has("error")) return true;
  const hash = window.location.hash;
  return hash.includes("access_token") || hash.includes("error_description");
}

/**
 * Връща валидна сесия с access_token. Ако токенът е изтекъл или близо до изтичане
 * (по-малко от 60s), прави refresh. Ако няма сесия или refresh се провали - връща null.
 */
async function ensureFreshSession(): Promise<string | null> {
  try {
    const sessData = await withTimeout(supabase.auth.getSession());
    let session = sessData?.data.session ?? null;

    const nowSec = () => Math.floor(Date.now() / 1000);
    const isExpiring = (s: typeof session) =>
      !s?.access_token || (s.expires_at ?? 0) - nowSec() < 60;

    if (isExpiring(session)) {
      const { data: refreshed, error: refreshErr } =
        await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session?.access_token) {
        if (session?.access_token) return session.access_token;
        await supabase.auth.signOut().catch(() => {});
        return null;
      }
      session = refreshed.session;
    }

    if (!session?.access_token) return null;

    const userResult = await withTimeout(supabase.auth.getUser());
    if (userResult) {
      const { data: userData, error: userErr } = userResult;
      if (userErr || !userData.user) {
        await supabase.auth.signOut().catch(() => {});
        return null;
      }
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
  const [crmAccess, setCrmAccess] = useState<{ ok: boolean; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (hasOAuthReturn()) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await ensureFreshSession();
      if (cancelled) return;
      if (!token) {
        navigate({ to: "/login", replace: true });
        return;
      }
      try {
        const accessResult = await checkAdminAccess();
        if (cancelled) return;
        const ok = !!accessResult?.hasCrmAccess;
        const isAdmin = !!accessResult?.isAdmin;
        setCrmAccess({ ok, isAdmin });
        if (ok) {
          logAdminAccess({ data: { path: "/admin" } }).catch(() => {});
        }
      } catch (error) {
        console.error("admin access check failed", error);
        if (!cancelled) setCrmAccess({ ok: false, isAdmin: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  if (loading || crmAccess === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#5e0f1d] text-amber-100/70">
        Зареждане...
      </div>
    );
  }
  if (!user) return null;
  if (!crmAccess.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#5e0f1d] px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-amber-100">Нямате достъп</h1>
          <p className="mt-2 text-sm text-amber-100/60">
            Този раздел е за екипа на агенцията (администратори и брокери). Свържете се с администратор, ако трябва достъп.
          </p>
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
