import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveSupabaseServiceKey } from "@/lib/supabase-env";

export type ServerDb = SupabaseClient<Database>;

/** Prefer service role when configured; otherwise use the signed-in user's Supabase client (RLS). */
export function resolveServerDb(userClient?: ServerDb): ServerDb {
  if (resolveSupabaseServiceKey()) return supabaseAdmin;
  if (userClient) return userClient;
  return supabaseAdmin;
}
