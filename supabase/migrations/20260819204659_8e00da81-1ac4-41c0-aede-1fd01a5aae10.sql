GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_broker_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_full_access(uuid) TO authenticated;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brokers TO authenticated;
GRANT SELECT ON public.brokers TO anon;
GRANT ALL ON public.brokers TO service_role;

DROP POLICY IF EXISTS "brokers public read active" ON public.brokers;
CREATE POLICY "brokers public read active" ON public.brokers FOR SELECT TO anon USING (is_active = true);

INSERT INTO public.brokers (user_id, full_name, email, is_active)
SELECT u.id, COALESCE(p.full_name, split_part(u.email, '@', 1)), u.email, true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.brokers b WHERE b.user_id = u.id);