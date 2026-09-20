CREATE OR REPLACE FUNCTION public.is_crm_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role <> 'user'::app_role
  )
$$;

DROP POLICY IF EXISTS commissions_auth_all ON public.commissions;
CREATE POLICY commissions_staff_all ON public.commissions FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS commission_splits_auth_all ON public.commission_splits;
CREATE POLICY commission_splits_staff_all ON public.commission_splits FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS commission_payouts_auth_all ON public.commission_payouts;
CREATE POLICY commission_payouts_staff_all ON public.commission_payouts FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS commission_rules_auth_all ON public.commission_rules;
CREATE POLICY commission_rules_staff_all ON public.commission_rules FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS commission_events_auth_all ON public.commission_events;
CREATE POLICY commission_events_staff_all ON public.commission_events FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "crm manages documents" ON public.document_items;
CREATE POLICY document_items_staff_all ON public.document_items FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS "crm manages doc requests" ON public.document_requests;
CREATE POLICY document_requests_staff_all ON public.document_requests FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS leads_auth_all ON public.leads;
CREATE POLICY leads_staff_all ON public.leads FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS lead_events_auth_all ON public.lead_events;
CREATE POLICY lead_events_staff_all ON public.lead_events FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS lead_qualifications_auth_all ON public.lead_qualifications;
CREATE POLICY lead_qualifications_staff_all ON public.lead_qualifications FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS qualification_answers_auth_all ON public.qualification_answers;
CREATE POLICY qualification_answers_staff_all ON public.qualification_answers FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS contact_attempts_auth_all ON public.contact_attempts;
CREATE POLICY contact_attempts_staff_all ON public.contact_attempts FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));