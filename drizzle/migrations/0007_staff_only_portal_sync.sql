DROP POLICY IF EXISTS portal_listings_auth_all ON public.portal_listings;
CREATE POLICY portal_listings_staff_all ON public.portal_listings FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS portal_sync_log_auth_all ON public.portal_sync_log;
CREATE POLICY portal_sync_log_staff_all ON public.portal_sync_log FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));
