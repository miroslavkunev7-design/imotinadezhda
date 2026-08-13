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

export async function loadUserAccess(userId: string): Promise<UserAccess> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: roleRows, error: roleErr }, { data: broker, error: brokerErr }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("brokers").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  if (roleErr) console.error("loadUserAccess roles failed", roleErr);
  if (brokerErr) console.error("loadUserAccess broker failed", brokerErr);

  const roles = (roleRows ?? []).map((r) => String(r.role));
  const roleSet = new Set(roles);
  const isAdmin = roleSet.has("admin");
  const hasStaffRole = CRM_STAFF_ROLES.some((r) => roleSet.has(r));
  const hasCrmAccess = isAdmin || hasStaffRole || !!broker;

  return {
    isAdmin,
    hasCrmAccess,
    roles,
    brokerId: broker?.id ?? null,
  };
}

export async function assertCrmAccess(userId: string): Promise<UserAccess> {
  const access = await loadUserAccess(userId);
  if (!access.hasCrmAccess) {
    throw new Error("Forbidden — CRM access required");
  }
  return access;
}

export async function assertAdmin(userId: string): Promise<UserAccess> {
  const access = await loadUserAccess(userId);
  if (!access.isAdmin) {
    throw new Error("Forbidden — admin only");
  }
  return access;
}

export async function assertAdminOrOwnBroker(userId: string, brokerId: string): Promise<UserAccess> {
  const access = await assertCrmAccess(userId);
  if (access.isAdmin || access.brokerId === brokerId) {
    return access;
  }
  throw new Error("Forbidden — admin only");
}
