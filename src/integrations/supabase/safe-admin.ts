import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  resolveSupabaseAnonKey,
  resolveSupabaseServiceKey,
  resolveSupabaseUrl,
} from "@/lib/supabase-env";

let _client: ReturnType<typeof createClient<Database>> | undefined;

function getAdminOrAnonClient(): ReturnType<typeof createClient<Database>> {
  if (_client) return _client;

  const url = resolveSupabaseUrl();
  const serviceKey = resolveSupabaseServiceKey();
  const anonKey = resolveSupabaseAnonKey();

  if (serviceKey) {
    _client = createClient<Database>(url, serviceKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  } else {
    console.warn(
      "[Supabase] ⚠ SUPABASE_SERVICE_ROLE_KEY не е зададен. Работим с anon ключ и RLS. " +
        "Ако admin операции се провалят с 'permission denied', добави ключа във Vercel → Settings → Environment Variables (secret).",
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

/** Server-side Supabase client — same resilient client as safeAdmin. */
export const supabaseAdmin = safeAdmin;
