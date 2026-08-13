import { validateSupabaseEnv } from "./supabase-env";

export type SupabaseHealthState =
  | { status: "pending" }
  | { status: "ok"; host: string }
  | {
      status: "error";
      kind: "config" | "auth" | "network";
      httpStatus?: number;
      message: string;
      host: string;
    };

type Listener = (s: SupabaseHealthState) => void;

let _state: SupabaseHealthState = { status: "pending" };
let _kicked = false;
const _listeners = new Set<Listener>();

function setState(next: SupabaseHealthState) {
  _state = next;
  for (const l of _listeners) {
    try {
      l(next);
    } catch {
      /* ignore */
    }
  }
}

export function getSupabaseHealth(): SupabaseHealthState {
  return _state;
}

export function subscribeSupabaseHealth(l: Listener): () => void {
  _listeners.add(l);
  return () => _listeners.delete(l);
}

function hostOf(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

/**
 * Fire a single lightweight ping to the Supabase REST endpoint from the browser
 * to detect misconfigured env vars / rejected keys. No-op on the server.
 */
export function pingSupabase(): void {
  if (_kicked || typeof window === "undefined") return;
  _kicked = true;

  const v = validateSupabaseEnv();
  if (!v.ok) {
    setState({
      status: "error",
      kind: "config",
      message: v.details,
      host: hostOf(v.url),
    });
    return;
  }

  const host = hostOf(v.url);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);

  fetch(`${v.url}/rest/v1/theme_settings?select=singleton&singleton=eq.true&limit=1`, {
    method: "GET",
    headers: {
      apikey: v.anonKey,
      Authorization: `Bearer ${v.anonKey}`,
      "Accept-Profile": "public",
    },
    signal: controller.signal,
  })
    .then((r) => {
      window.clearTimeout(timeout);
      // Probe a real public table. The PostgREST root endpoint can return 401
      // even with a valid publishable key, so it is not reliable for this app.
      if (r.status === 401 || r.status === 403) {
        setState({
          status: "error",
          kind: "auth",
          httpStatus: r.status,
          message: "Supabase отхвърли публичния ключ (401/403).",
          host,
        });
        return;
      }
      setState({ status: "ok", host });
    })
    .catch((err) => {
      window.clearTimeout(timeout);
      setState({
        status: "error",
        kind: "network",
        message:
          err?.name === "AbortError"
            ? "Времето за връзка с Supabase изтече."
            : `Мрежова грешка при връзка с ${host}.`,
        host,
      });
    });
}