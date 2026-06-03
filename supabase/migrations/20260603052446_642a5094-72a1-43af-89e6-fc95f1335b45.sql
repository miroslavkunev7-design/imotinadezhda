GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "admin_access_log service role insert" ON public.admin_access_log;
CREATE POLICY "admin_access_log service role insert"
ON public.admin_access_log
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');