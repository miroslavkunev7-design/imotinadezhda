ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.is_full_access(uuid) SECURITY INVOKER;
ALTER FUNCTION public.current_broker_id(uuid) SECURITY INVOKER;