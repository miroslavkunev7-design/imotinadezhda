// Shared admin role gate. Used by server-fn handlers that must be admin-only.
// Throws "Forbidden — admin only" if the user lacks the admin role.
export { assertAdmin, assertCrmAccess, assertAdminOrOwnBroker, loadUserAccess } from "@/lib/auth/crm-access";
