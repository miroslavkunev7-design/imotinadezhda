// Wraps supabaseAdmin with graceful fallback to the anon client when
// SUPABASE_SERVICE_ROLE_KEY is not configured (e.g. preview deployments).
// Data will be subject to RLS policies in fallback mode.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _client: ReturnType<typeof createClient<Database>> | undefined;

function getAdminOrAnonClient(): ReturnType<typeof createClient<Database>> {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL environment variable. Configure it in Vercel → Environment Variables.",
    );
  }

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
