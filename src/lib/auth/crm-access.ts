/** Roles that may use the CRM /admin area (not public "user" only). */
export const CRM_STAFF_ROLES = [
  "admin",
  "boss",
  "head_broker",
  "secretary",
  "broker",
  "consultant",
  "rental_dept",
  "agent",
] as const;

export type CrmStaffRole = (typeof CRM_STAFF_ROLES)[number];

export type UserAccess = {
  isAdmin: boolean;
  hasCrmAccess: boolean;
  roles: string[];
  brokerId: string | null;
};

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";

async function hasRoleRpc(
  db: ServerDb,
  userId: string,
  role: CrmStaffRole,
): Promise<boolean> {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: role });
  if (error) return false;
  return !!data;
}

export async function loadUserAccess(
  userId: string,
  userClient?: SupabaseClient<Database>,
  email?: string | null,
): Promise<UserAccess> {
  const db = resolveServerDb(userClient);

  const [
    { data: roleRows, error: roleErr },
    { data: brokerRow, error: brokerErr },
    { data: brokerIdRpc, error: brokerRpcErr },
    { data: isFullAccess, error: fullAccessErr },
  ] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    db.from("brokers").select("id").eq("user_id", userId).maybeSingle(),
    db.rpc("current_broker_id", { _user_id: userId }),
    db.rpc("is_full_access", { _user_id: userId }),
  ]);

  if (roleErr) console.error("loadUserAccess roles failed", roleErr);
  if (brokerErr) console.error("loadUserAccess broker failed", brokerErr);
  if (brokerRpcErr) console.error("loadUserAccess current_broker_id failed", brokerRpcErr);
  if (fullAccessErr) console.error("loadUserAccess is_full_access failed", fullAccessErr);

  let roles = (roleRows ?? []).map((r) => String(r.role));
  let brokerId =
    brokerRow?.id ?? (typeof brokerIdRpc === "string" ? brokerIdRpc : null) ?? null;

  if (!brokerId && email?.trim()) {
    const { data: byEmail } = await db
      .from("brokers")
      .select("id")
      .ilike("email", email.trim())
      .eq("is_active", true)
      .maybeSingle();
    brokerId = byEmail?.id ?? null;
  }

  if (roles.length === 0 && userClient) {
    const found = await Promise.all(
      CRM_STAFF_ROLES.map(async (role) => ((await hasRoleRpc(db, userId, role)) ? role : null)),
    );
    roles = found.filter(Boolean) as string[];
  }

  const roleSet = new Set(roles);
  const isAdmin =
    roleSet.has("admin") ||
    roleSet.has("boss") ||
    roleSet.has("head_broker") ||
    roleSet.has("secretary") ||
    !!isFullAccess;
  const hasStaffRole = CRM_STAFF_ROLES.some((r) => roleSet.has(r));
  const hasCrmAccess = isAdmin || hasStaffRole || !!brokerId;

  return {
    isAdmin,
    hasCrmAccess,
    roles,
    brokerId,
  };
}

export async function assertCrmAccess(
  userId: string,
  userClient?: ServerDb,
  email?: string | null,
): Promise<UserAccess> {
  const access = await loadUserAccess(userId, userClient, email);
  if (!access.hasCrmAccess) {
    throw new Error("Forbidden — CRM access required");
  }
  return access;
}

export async function assertAdmin(
  userId: string,
  userClient?: ServerDb,
  email?: string | null,
): Promise<UserAccess> {
  const access = await loadUserAccess(userId, userClient, email);
  if (!access.isAdmin) {
    throw new Error("Forbidden — admin only");
  }
  return access;
}

export async function assertAdminOrOwnBroker(
  userId: string,
  brokerId: string,
  userClient?: ServerDb,
  email?: string | null,
): Promise<UserAccess> {
  const access = await assertCrmAccess(userId, userClient, email);
  if (access.isAdmin || access.brokerId === brokerId) {
    return access;
  }
  throw new Error("Forbidden — admin only");
}
