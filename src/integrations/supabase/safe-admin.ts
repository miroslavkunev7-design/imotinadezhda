// Wraps supabaseAdmin with graceful fallback to the anon client when
// SUPABASE_SERVICE_ROLE_KEY is not configured (e.g. Vercel deployments without secrets).
// Data will be subject to RLS policies in fallback mode.
// Note: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are PUBLIC values already
// present in the client-side bundle via VITE_ vars, so they are safe to embed here.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const FALLBACK_URL = "https://zcrzxgzyptqibsajoece.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjcnp4Z3p5cHRxaWJzYWpvZWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDgwMjMsImV4cCI6MjA5NTgyNDAyM30.jHsY0umR0xZi0AKT9nNWAB34hRh84VrgjkIt52CuLo8";

let _client: ReturnType<typeof createClient<Database>> | undefined;

function getAdminOrAnonClient(): ReturnType<typeof createClient<Database>> {
  if (_client) return _client;

  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    FALLBACK_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    FALLBACK_ANON_KEY;

  if (serviceKey) {
    _client = createClient<Database>(url, serviceKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  } else {
    console.warn(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. " +
        "Data will be subject to RLS policies.",
    );
    _client = createClient<Database>(url, anonKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  }

  return _client;
}

export const safeAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop, receiver) {
    return Reflect.get(getAdminOrAnonClient(), prop, receiver);
  },
});
