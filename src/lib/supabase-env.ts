/** Shared Supabase project defaults (public anon key — safe for client-side). */
export const SUPABASE_PROJECT_URL = "https://zcrzxgzyptqibsajoece.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjcnp4Z3p5cHRxaWJzYWpvZWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDgwMjMsImV4cCI6MjA5NTgyNDAyM30.jHsY0umR0xZi0AKT9nNWAB34hRh84VrgjkIt52CuLo8";

export function resolveSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    (typeof import.meta !== "undefined" ? import.meta.env.VITE_SUPABASE_URL : undefined) ??
    SUPABASE_PROJECT_URL
  );
}

export function resolveSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    (typeof import.meta !== "undefined" ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ??
    SUPABASE_ANON_KEY
  );
}

export function resolveSupabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}
