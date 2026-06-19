import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from "@/lib/supabase-env";

function createSupabaseClient() {
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();

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
