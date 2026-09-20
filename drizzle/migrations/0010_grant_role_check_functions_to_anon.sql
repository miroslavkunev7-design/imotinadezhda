GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crm_staff(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_crm_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_full_access(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_full_access(uuid) TO authenticated;