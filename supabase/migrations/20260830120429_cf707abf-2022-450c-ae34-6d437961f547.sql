REVOKE EXECUTE ON FUNCTION public.is_crm_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_crm_staff(uuid) TO authenticated, service_role;