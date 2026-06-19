import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithOAuth } from "@/integrations/app-auth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import { SiteHeader } from "@/components/site/site-header";
import { setRememberMe } from "@/lib/remember-me";
import loginHeroPoster from "@/assets/login-hero.jpeg";
import { resolveAssetUrl } from "@/lib/asset-url";
import loginHeroVideo from "@/assets/login-hero.mp4.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход | Имоти Надежда" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [quality, setQuality] = useState<"4k" | "8k">("4k");

  // Video quality sources. Both currently point to the same uploaded clip;
  // replace the 8K entry when a true 8K master is uploaded.
  const videoSources: Record<"4k" | "8k", string> = {
    "4k": resolveAssetUrl(loginHeroVideo) || loginHeroPoster,
    "8k": resolveAssetUrl(loginHeroVideo) || loginHeroPoster,
  };

  useEffect(() => {
    if (!loading && user) {
      window.location.replace("/admin");
    }
  }, [loading, user]);

  // QR code points to this page so a phone scan opens login directly.
  // Initialize to null to avoid SSR/client mismatch — fill on mount.
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  useEffect(() => {
    setLoginUrl(`${window.location.origin}/login`);
  }, []);


  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setRememberMe(remember);
      const normEmail = email.trim().toLowerCase();
      const normPassword = password.trim();
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: normEmail,
          password: normPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: normEmail, password: normPassword });
        if (err) throw err;
      }

      window.location.replace("/admin");
    } catch (err: any) {
      console.error("[login] sign-in failed", err);
      const msg = err?.message ?? "Възникна грешка";
      // Translate common Supabase errors to Bulgarian
      const translated = msg.includes("Invalid login credentials")
        ? "Грешен имейл или парола"
        : msg.includes("Email not confirmed")
        ? "Имейлът не е потвърден"
        : msg.includes("rate limit")
        ? "Твърде много опити — изчакай малко"
        : msg;
      setError(translated);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      setRememberMe(remember);
      const result = await signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/admin`,
      });
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        setError(msg);
        setGoogleBusy(false);
        return;
      }
      if (result.redirected) return; // browser will navigate to Google
      window.location.replace("/admin");
    } catch (err: any) {
      setError(err?.message ?? "Грешка при вход с Google");
      setGoogleBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-black">
      <LoginVideo src={videoSources[quality]} quality={quality} />
      <SiteHeader />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(139,26,43,0.25) 0%, rgba(0,0,0,0.15) 45%, rgba(139,26,43,0.35) 100%)",
        }}
      />
      {/* Quality toggle 4K / 8K */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-[#C9A84C]/60 bg-black/45 p-1 backdrop-blur-md">
        {(["4k", "8k"] as const).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuality(q)}
            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition ${
              quality === q
                ? "bg-[#C9A84C] text-[#2b1418] shadow"
                : "text-white/85 hover:text-white"
            }`}
            aria-pressed={quality === q}
          >
            {q.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center gap-8 px-4 pb-8 pt-24 md:pt-8">
        {/* Login card — solid backing for readability */}
        <div className="relative w-full max-w-md rounded-2xl border border-[#C9A84C]/40 bg-white/95 p-6 shadow-[0_30px_70px_-20px_rgba(139,26,43,0.45)] ring-1 ring-[#C9A84C]/30 backdrop-blur-md md:p-8">
          <div className="mb-6 text-center">
            <Link to="/" className="font-display text-2xl text-[#8B1A2B]">Имоти Надежда</Link>
            <h1 className="mt-3 font-display text-3xl text-[#2b1418]">
              {mode === "signin" ? "Вход" : "Регистрация"}
            </h1>
            <p className="mt-1 text-sm text-[#5a3a3f]">
              {mode === "signin" ? "Влез в админ панела" : "Създай нов профил"}
            </p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleBusy || busy}
            className="mb-3 flex w-full items-center justify-center gap-2.5 rounded-lg border-2 border-[#8B1A2B]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#2b1418] shadow-sm transition hover:border-[#C9A84C] hover:bg-[#fff8ec] hover:shadow-md disabled:opacity-60"
          >
            <GoogleIcon />
            {googleBusy ? "Свързване..." : "Влез с Google"}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">или</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
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

            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[#8B1A2B]"
              />
              <span className="text-sm text-[#2b1418]">Запомни ме</span>
            </label>

            {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <Button type="submit" disabled={busy} className="gold-cta-button w-full">
              {busy ? "Моля изчакайте..." : mode === "signin" ? "Вход" : "Регистрация"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-[#8B1A2B] underline-offset-2 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Нямаш профил? Регистрирай се" : "Имаш профил? Влез"}
          </button>
        </div>

        {/* QR code card — desktop only */}
        <div className="relative hidden w-[260px] flex-col items-center rounded-2xl border border-[#C9A84C]/50 bg-white/95 p-6 text-center shadow-[0_30px_70px_-20px_rgba(139,26,43,0.4)] ring-1 ring-[#C9A84C]/30 lg:flex">
          <h2 className="font-display text-lg text-[#8B1A2B]">Сканирай за вход</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Отвори страницата за вход на телефона си
          </p>
          <div className="mt-4 rounded-xl border-4 border-[#C9A84C] bg-white p-3 shadow-inner">
            {loginUrl && (
              <QRCodeSVG
                value={loginUrl}
                size={172}
                level="M"
                fgColor="#8B1A2B"
                bgColor="#ffffff"
              />
            )}
          </div>
          <p className="mt-3 break-all text-[10px] text-muted-foreground">{loginUrl ?? ""}</p>
        </div>
      </div>
    </main>
  );
}

function LoginVideo({ src, quality }: { src: string; quality: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    const tryPlay = () => {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          const resume = () => {
            el.play().catch(() => {});
            window.removeEventListener("touchstart", resume);
            window.removeEventListener("click", resume);
          };
          window.addEventListener("touchstart", resume, { once: true, passive: true });
          window.addEventListener("click", resume, { once: true });
        });
      }
    };
    if (el.readyState >= 2) tryPlay();
    else el.addEventListener("loadeddata", tryPlay, { once: true });
  }, [src]);
  return (
    <video
      key={quality}
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover md:object-contain"
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      onEnded={(e) => {
        const v = e.currentTarget;
        try {
          v.currentTime = 0;
          void v.play();
        } catch {}
      }}
    />
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.1 36.1 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
