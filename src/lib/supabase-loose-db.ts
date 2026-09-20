/**
 * Помощник за таблици, които още не са в генерираните типове на базата.
 *
 * Някои CRM модули ползват таблици, които липсват в текущия генериран
 * `types.ts`. За да остане typecheck-ът чист, заявките към тях минават през
 * „свободен“ (нетипизиран) клиент. Логиката и правата в базата не се променят.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";

export type LooseDb = SupabaseClient<any, "public", any>;

/** Каст на произволен Supabase клиент към нетипизиран. */
export function looseDb(client: unknown): LooseDb {
  return client as LooseDb;
}

/** Както `resolveServerDb`, но без строги типове за таблиците. */
export function resolveLooseDb(userClient?: ServerDb): LooseDb {
  return looseDb(resolveServerDb(userClient));
}
