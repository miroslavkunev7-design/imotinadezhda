import { useEffect, useState } from "react";
import { validateSupabaseEnv } from "@/lib/supabase-env";
import {
  getSupabaseHealth,
  subscribeSupabaseHealth,
  type SupabaseHealthState,
} from "@/lib/supabase-health";

const DISMISS_KEY = "supabase-config-banner-dismissed";

function useHealth(): SupabaseHealthState {
  const [s, setS] = useState<SupabaseHealthState>(() => getSupabaseHealth());
  useEffect(() => subscribeSupabaseHealth(setS), []);
  return s;
}

export function SupabaseConfigBanner() {
  const health = useHealth();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!mounted || dismissed) return null;

  const validation = validateSupabaseEnv();

  // Decide whether to show
  const configProblem = !validation.ok;
  const fallbackInProd =
    validation.ok && validation.source === "fallback" && import.meta.env.PROD;
  const healthProblem = health.status === "error";

  if (!configProblem && !fallbackInProd && !healthProblem) return null;

  // Build headline + details
  let headline = "Проблем с връзката към базата данни.";
  const details: string[] = [];

  if (!validation.ok) {
    if (validation.reason === "invalid_url") {
      headline = "Невалиден URL към Supabase.";
    } else {
      headline = "Невалиден формат на публичния ключ.";
    }
    details.push(validation.details);
  } else if (fallbackInProd) {
    headline = "Env променливите не са стигнали до билда.";
    const missing: string[] = [];
    if (validation.urlSource === "fallback") missing.push("VITE_SUPABASE_URL");
    if (validation.keySource === "fallback") missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
    details.push(
      `Използва се резервен (hardcoded) ключ. Липсват: ${missing.join(", ")}.`,
    );
  }

  if (health.status === "error") {
    if (health.kind === "auth") {
      details.push(
        `Supabase отхвърли публичния ключ (HTTP ${health.httpStatus ?? "?"}). Провери дали ключът съвпада с проекта на ${health.host}.`,
      );
    } else if (health.kind === "network") {
      details.push(health.message);
    } else {
      details.push(health.message);
    }
  }

  const host =
    health.status !== "pending" && "host" in health
      ? health.host
      : validation.ok
        ? new URL(validation.url).host
        : "—";

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483000,
        background: "#8B1A2B",
        color: "#FBF7EE",
        borderBottom: "2px solid #C9A84C",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 14,
        lineHeight: 1.4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "10px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: "20px" }}>⚠️</span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600 }}>{headline}</div>
          <div style={{ opacity: 0.9, marginTop: 2 }}>
            Провери <code style={{ background: "rgba(0,0,0,0.25)", padding: "1px 6px", borderRadius: 4 }}>VITE_SUPABASE_URL</code>
            {" и "}
            <code style={{ background: "rgba(0,0,0,0.25)", padding: "1px 6px", borderRadius: 4 }}>VITE_SUPABASE_PUBLISHABLE_KEY</code>
            {" във Vercel → Settings → Environment Variables или в локалния "}
            <code style={{ background: "rgba(0,0,0,0.25)", padding: "1px 6px", borderRadius: 4 }}>.env</code>.
          </div>
          {expanded && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20, opacity: 0.95 }}>
              <li>Хост: <code>{host}</code></li>
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "transparent",
            color: "#FBF7EE",
            border: "1px solid rgba(251,247,238,0.4)",
            padding: "4px 10px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {expanded ? "Скрий" : "Подробности"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: "#C9A84C",
            color: "#4A0E1A",
            border: "none",
            padding: "4px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Разбрах
        </button>
      </div>
    </div>
  );
}