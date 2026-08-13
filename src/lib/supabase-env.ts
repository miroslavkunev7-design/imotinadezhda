/** Shared Supabase project defaults (public anon key — safe for client-side). */
export const SUPABASE_PROJECT_URL = "https://bxtxygakafwusstpptkg.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHh5Z2FrYWZ3dXNzdHBwdGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NzM3MDYsImV4cCI6MjA5NTI0OTcwNn0.bf6lLdApnbICmMEyOvTOy7KEsBBeT5hCsjM_M6aElXg";

function pickEnv(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function readEnv(name: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" && process?.env ? process.env[name] : undefined;
  const fromImportMeta =
    typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string | undefined> }).env
      ? (import.meta as { env: Record<string, string | undefined> }).env[name]
      : undefined;
  return pickEnv(fromProcess, fromImportMeta);
}

function resolveWithSource(...names: string[]): { value: string | undefined; envName?: string } {
  for (const name of names) {
    const v = readEnv(name);
    if (v) return { value: v, envName: name };
  }
  return { value: undefined };
}

export function resolveSupabaseUrl(): string {
  return (
    resolveWithSource("SUPABASE_URL", "VITE_SUPABASE_URL").value ?? SUPABASE_PROJECT_URL
  );
}

export function resolveSupabaseAnonKey(): string {
  return (
    resolveWithSource("SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY").value ??
    SUPABASE_ANON_KEY
  );
}

export function resolveSupabaseServiceKey(): string | undefined {
  return resolveWithSource("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY").value;
}

// ---------------------------------------------------------------------------
// Validation — friendly diagnostics for missing/invalid env vars
// ---------------------------------------------------------------------------

export type SupabaseEnvValidation =
  | {
      ok: true;
      url: string;
      anonKey: string;
      /** "env" = read from an env var; "fallback" = using hardcoded defaults */
      source: "env" | "fallback";
      urlSource: "env" | "fallback";
      keySource: "env" | "fallback";
      urlEnvName?: string;
      keyEnvName?: string;
    }
  | {
      ok: false;
      reason: "invalid_url" | "invalid_key_format";
      details: string;
      url: string;
      anonKey: string;
    };

function isValidSupabaseUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return false;
    // Accept *.supabase.co, *.supabase.in and custom domains (any https host with hostname)
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isValidJwtShape(k: string): boolean {
  // Supabase publishable/anon keys are JWTs (3 base64url parts separated by ".")
  // New format sb_publishable_... is also acceptable.
  if (k.startsWith("sb_publishable_") || k.startsWith("sb_secret_")) return true;
  const parts = k.split(".");
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0);
}

let _cachedValidation: SupabaseEnvValidation | undefined;
let _loggedOnce = false;

export function validateSupabaseEnv(): SupabaseEnvValidation {
  if (_cachedValidation) return _cachedValidation;

  const urlResolved = resolveWithSource("SUPABASE_URL", "VITE_SUPABASE_URL");
  const keyResolved = resolveWithSource(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  );

  const url = urlResolved.value ?? SUPABASE_PROJECT_URL;
  const anonKey = keyResolved.value ?? SUPABASE_ANON_KEY;
  const urlSource: "env" | "fallback" = urlResolved.value ? "env" : "fallback";
  const keySource: "env" | "fallback" = keyResolved.value ? "env" : "fallback";

  if (!isValidSupabaseUrl(url)) {
    _cachedValidation = {
      ok: false,
      reason: "invalid_url",
      details: `Стойността "${url}" не е валиден https URL към Supabase проект.`,
      url,
      anonKey,
    };
    return _cachedValidation;
  }
  if (!isValidJwtShape(anonKey)) {
    _cachedValidation = {
      ok: false,
      reason: "invalid_key_format",
      details: "Публичният ключ (anon / publishable) не е във валиден JWT формат.",
      url,
      anonKey,
    };
    return _cachedValidation;
  }

  const source: "env" | "fallback" = urlSource === "env" && keySource === "env" ? "env" : "fallback";
  _cachedValidation = {
    ok: true,
    url,
    anonKey,
    source,
    urlSource,
    keySource,
    urlEnvName: urlResolved.envName,
    keyEnvName: keyResolved.envName,
  };
  return _cachedValidation;
}

/** Log a single boot line describing the Supabase connection state. */
export function logSupabaseBootDiagnostic(): void {
  if (_loggedOnce) return;
  _loggedOnce = true;
  const v = validateSupabaseEnv();
  const host = (() => {
    try {
      return new URL(v.url).host;
    } catch {
      return v.url;
    }
  })();
  if (!v.ok) {
    console.error(`[Supabase] ✖ Конфигурационна грешка (${v.reason}): ${v.details}`);
    return;
  }
  if (v.source === "fallback") {
    console.warn(
      `[Supabase] ⚠ Използва се резервен ключ — VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY не са попаднали в билда (host: ${host}).`,
    );
  } else {
    console.info(`[Supabase] ✓ Свързано с ${host} през env променливи.`);
  }
}
