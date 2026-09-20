DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['reactivation_enrollments','reactivation_messages','reactivation_campaigns','reactivation_templates','reactivation_events']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()))', t||'_staff_all', t);
  END LOOP;
END $$;