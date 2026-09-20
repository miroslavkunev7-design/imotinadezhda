import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { siteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Нова парола | Имоти Надежда" },
      {
        name: "description",
        content: "Задай нова парола за достъп до CRM панела на Имоти Надежда.",
      },
      { property: "og:title", content: "Нова парола | Имоти Надежда" },
      {
        property: "og:description",
        content: "Задай нова парола за достъп до CRM панела на Имоти Надежда.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: siteUrl("/reset-password") }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase поставя recovery сесията от линка в имейла.
  useEffect(() => {
    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted && session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.trim().length < 6) {
      setError("Паролата трябва да е поне 6 символа");
      return;
    }
    if (password !== confirm) {
      setError("Паролите не съвпадат");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: password.trim() });
      if (err) throw err;
      setDone(true);
      window.setTimeout(() => navigate({ to: "/admin", replace: true }), 1200);
    } catch (err: any) {
      setError(err?.message ?? "Грешка при смяна на паролата");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-[#5e0f1d]">
      <SiteHeader overlay />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8 pt-28 site-header-overlay-pad md:pt-8">
        <div className="w-full max-w-md rounded-2xl border border-[#C9A84C]/40 bg-white/95 p-6 shadow-[0_30px_70px_-20px_rgba(139,26,43,0.45)] md:p-8">
          <h1 className="text-center font-display text-3xl text-[#2b1418]">Нова парола</h1>
          <p className="mt-1 text-center text-sm text-[#5a3a3f]">
            {ready
              ? "Въведи новата си парола."
              : "Отвори линка от имейла за възстановяване, за да зададеш нова парола."}
          </p>

          {done ? (
            <div className="mt-5 rounded-md bg-[#8B1A2B]/10 px-3 py-3 text-center text-sm text-[#8B1A2B]">
              Паролата е сменена. Пренасочваме те към панела...
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="password"
                placeholder="Нова парола (мин. 6 символа)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                disabled={!ready}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="Повтори новата парола"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
                disabled={!ready}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={busy || !ready} className="gold-cta-button w-full">
                {busy ? "Записване..." : "Запази новата парола"}
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="mt-4 block text-center text-sm text-[#8B1A2B] underline-offset-2 hover:underline"
          >
            Обратно към вход
          </Link>
        </div>
      </div>
    </main>
  );
}
