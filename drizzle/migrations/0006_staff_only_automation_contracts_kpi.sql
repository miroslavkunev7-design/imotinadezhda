-- Automation
DROP POLICY IF EXISTS automation_jobs_auth_all ON public.automation_jobs;
CREATE POLICY automation_jobs_staff_all ON public.automation_jobs FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS automation_settings_auth_all ON public.automation_settings;
CREATE POLICY automation_settings_staff_all ON public.automation_settings FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

-- Contract pipeline
DROP POLICY IF EXISTS contract_queue_auth_all ON public.contract_queue;
CREATE POLICY contract_queue_staff_all ON public.contract_queue FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS contract_events_auth_all ON public.contract_events;
CREATE POLICY contract_events_staff_all ON public.contract_events FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS contract_counters_auth_read ON public.contract_counters;
CREATE POLICY contract_counters_staff_read ON public.contract_counters FOR SELECT TO authenticated
  USING (public.is_crm_staff(auth.uid()));

-- KPI
DROP POLICY IF EXISTS kpi_snapshots_auth_all ON public.kpi_snapshots;
CREATE POLICY kpi_snapshots_staff_all ON public.kpi_snapshots FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS kpi_targets_auth_all ON public.kpi_targets;
CREATE POLICY kpi_targets_staff_all ON public.kpi_targets FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS kpi_briefings_auth_all ON public.kpi_briefings;
CREATE POLICY kpi_briefings_staff_all ON public.kpi_briefings FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS kpi_events_auth_all ON public.kpi_events;
CREATE POLICY kpi_events_staff_all ON public.kpi_events FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid())) WITH CHECK (public.is_crm_staff(auth.uid()));
