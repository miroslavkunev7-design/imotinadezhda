import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
// (Google OAuth removed; only email/password auth)
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { logAdminAccess } from "@/lib/audit.functions";
import { SiteHeader } from "@/components/site/site-header";
import loginHero from "@/assets/login-hero.jpeg";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход | ИЛДЖ.ИА" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    logAdminAccess({
      data: { path: "/login", userId: user?.id ?? null, email: user?.email ?? null },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && user) {
      window.location.replace("/admin");
    }
  }, [loading, user]);


  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      window.location.replace("/admin");
    } catch (err: any) {
      setError(err?.message ?? "Възникна грешка");
    } finally {
      setBusy(false);
    }
  };

  // OAuth handler removed.

  return (
    <main
      className="relative flex h-screen max-h-screen flex-col overflow-hidden"
      style={{
        backgroundImage: `url(${loginHero})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <SiteHeader />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(139,26,43,0.35) 0%, rgba(255,255,255,0.25) 45%, rgba(139,26,43,0.45) 100%)",
        }}
      />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-md rounded-2xl border border-[#C9A84C]/50 bg-white/95 p-7 shadow-[0_30px_70px_-20px_rgba(139,26,43,0.4)] ring-1 ring-[#C9A84C]/30 md:p-8">



        <div className="mb-6 text-center">
          <Link to="/" className="font-display text-2xl text-primary">ИЛДЖ.ИА</Link>
          <h1 className="mt-3 font-display text-3xl text-accent-foreground">
            {mode === "signin" ? "Вход" : "Регистрация"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Влез в админ панела" : "Създай нов профил"}
          </p>
        </div>
        <form onSubmit={handle} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Име"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              required
            />
          )}
          <input
            type="email"
            placeholder="Имейл"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            placeholder="Парола (мин. 6 символа)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            required
          />
          {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <Button type="submit" disabled={busy} className="gold-cta-button w-full">
            {busy ? "Моля изчакайте..." : mode === "signin" ? "Вход" : "Регистрация"}
          </Button>
        </form>




        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Нямаш профил? Регистрирай се" : "Имаш профил? Влез"}
        </button>
      </div>
      </div>
    </main>
  );
}
