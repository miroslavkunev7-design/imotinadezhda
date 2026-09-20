DROP POLICY IF EXISTS "property_matches_auth_all" ON public.property_matches;

DROP POLICY IF EXISTS "seller_prospects_auth_all" ON public.seller_prospects;
CREATE POLICY "seller_prospects staff all" ON public.seller_prospects FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "seller_signals_auth_all" ON public.seller_signals;
CREATE POLICY "seller_signals staff all" ON public.seller_signals FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "seller_outreach_auth_all" ON public.seller_outreach;
CREATE POLICY "seller_outreach staff all" ON public.seller_outreach FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "viewings_auth_all" ON public.viewings;
CREATE POLICY "viewings staff all" ON public.viewings FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "viewing_reminders_auth_all" ON public.viewing_reminders;
CREATE POLICY "viewing_reminders staff all" ON public.viewing_reminders FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "owner_reports_auth_all" ON public.owner_reports;
CREATE POLICY "owner_reports staff all" ON public.owner_reports FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "owner_report_schedules_auth_all" ON public.owner_report_schedules;
CREATE POLICY "owner_report_schedules staff all" ON public.owner_report_schedules FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "review_requests_auth_all" ON public.review_requests;
CREATE POLICY "review_requests staff all" ON public.review_requests FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));