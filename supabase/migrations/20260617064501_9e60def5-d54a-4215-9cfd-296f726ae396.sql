GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_full_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_broker_id(uuid) TO authenticated, service_role;

GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;