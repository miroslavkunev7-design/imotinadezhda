import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход | ИЛДЖ.ИА" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    throw redirect({ to: "/admin" });
  }

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
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err?.message ?? "Възникна грешка");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/admin" });
      if (result.error) throw new Error(result.error.message || "Google sign-in грешка");
      if (result.redirected) return;
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err?.message ?? "Грешка при вход с Google");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-primary/15 bg-card p-8 shadow-xl">
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

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> или <div className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="outline" disabled={busy} onClick={handleGoogle} className="w-full">
          Вход с Google
        </Button>

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
