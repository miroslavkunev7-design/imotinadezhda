
REVOKE EXECUTE ON FUNCTION public.is_full_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_broker_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_full_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_broker_id(uuid) TO service_role;
