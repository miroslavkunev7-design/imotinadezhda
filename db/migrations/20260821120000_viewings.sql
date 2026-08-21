-- Automation №6: property viewings (огледи) with statuses and reminder stamps.
-- Writes go through CRM server functions (service role). Anon has no access.

CREATE TABLE IF NOT EXISTS public.viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  archived_property_id uuid REFERENCES public.archived_properties(id) ON DELETE SET NULL,
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  broker_task_id uuid REFERENCES public.broker_tasks(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  location text,
  notes text,
  property_title text,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'confirmed', 'done', 'cancelled', 'no_show')),
  reminded_day_before_at timestamptz,
  reminded_hours_before_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.viewings IS 'Scheduled property viewings for CRM; reminders day-before and ~2h before.';

CREATE INDEX IF NOT EXISTS idx_viewings_scheduled_at ON public.viewings (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_viewings_broker_id ON public.viewings (broker_id);
CREATE INDEX IF NOT EXISTS idx_viewings_client_id ON public.viewings (client_id);
CREATE INDEX IF NOT EXISTS idx_viewings_status ON public.viewings (status);
CREATE INDEX IF NOT EXISTS idx_viewings_reminders
  ON public.viewings (scheduled_at)
  WHERE status IN ('planned', 'confirmed')
    AND (reminded_day_before_at IS NULL OR reminded_hours_before_at IS NULL);

DROP TRIGGER IF EXISTS viewings_set_updated_at ON public.viewings;
CREATE TRIGGER viewings_set_updated_at
  BEFORE UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.viewings FROM PUBLIC, anon;
GRANT SELECT ON public.viewings TO authenticated;
GRANT ALL ON public.viewings TO service_role;

DROP POLICY IF EXISTS "viewings crm select" ON public.viewings;
CREATE POLICY "viewings crm select"
  ON public.viewings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_full_access(auth.uid())
    OR broker_id IN (SELECT id FROM public.brokers WHERE user_id = auth.uid())
  );
