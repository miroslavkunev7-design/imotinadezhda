/** Shared Supabase project defaults (public anon key — safe for client-side). */
export const SUPABASE_PROJECT_URL = "https://bxtxygakafwusstpptkg.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHh5Z2FrYWZ3dXNzdHBwdGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NzM3MDYsImV4cCI6MjA5NTI0OTcwNn0.bf6lLdApnbICmMEyOvTOy7KEsBBeT5hCsjM_M6aElXg";

function pickEnv(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function resolveSupabaseUrl(): string {
  return (
    pickEnv(
      process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_URL,
      typeof import.meta !== "undefined" ? import.meta.env.VITE_SUPABASE_URL : undefined,
    ) ?? SUPABASE_PROJECT_URL
  );
}

export function resolveSupabaseAnonKey(): string {
  return (
    pickEnv(
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      typeof import.meta !== "undefined" ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined,
    ) ?? SUPABASE_ANON_KEY
  );
}

export function resolveSupabaseServiceKey(): string | undefined {
  return pickEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY);
}
