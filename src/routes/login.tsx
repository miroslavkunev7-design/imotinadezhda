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
      className="relative flex min-h-screen items-center justify-center px-4 py-12"
      style={{
        backgroundImage: `url(${loginHero})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      <div className="relative w-full max-w-md rounded-2xl border border-amber-300/40 bg-[rgba(255,251,243,0.92)] p-8 shadow-2xl ring-1 ring-amber-300/30">

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
    </main>
  );
}
