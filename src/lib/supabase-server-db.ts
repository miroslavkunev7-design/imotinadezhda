import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveSupabaseServiceKey } from "@/lib/supabase-env";

export type ServerDb = SupabaseClient<Database>;

/**
 * Untyped server client. Use for tables/columns that exist in the database but
 * are not present in the generated Supabase types (e.g. tables added through
 * manual migrations).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseDb = SupabaseClient<any, any, any>;

/** Prefer service role when configured; otherwise use the signed-in user's Supabase client (RLS). */
export function resolveServerDb(userClient?: ServerDb): ServerDb {
  if (resolveSupabaseServiceKey()) return supabaseAdmin;
  if (userClient) return userClient;
  return supabaseAdmin;
}

/** Same resolution as {@link resolveServerDb}, but without generated table typings. */
export function resolveLooseDb(userClient?: ServerDb): LooseDb {
  return resolveServerDb(userClient) as unknown as LooseDb;
}
