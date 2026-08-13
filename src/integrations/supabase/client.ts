import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  logSupabaseBootDiagnostic,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
  validateSupabaseEnv,
} from "@/lib/supabase-env";
import { pingSupabase } from "@/lib/supabase-health";

function createSupabaseClient() {
  // Run validation + boot log once. Never throw here — the diagnostic banner
  // surfaces problems to the user; throwing would take down the whole app.
  validateSupabaseEnv();
  logSupabaseBootDiagnostic();

  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();

  // Kick off a one-time reachability check from the browser.
  if (typeof window !== "undefined") {
    try {
      pingSupabase();
    } catch {
      /* health check is best-effort */
    }
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
