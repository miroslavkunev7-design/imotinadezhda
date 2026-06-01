
-- 1) Clean up potentially invalid assigned_broker_id values (may currently hold user_id)
UPDATE public.clients c
SET assigned_broker_id = NULL
WHERE assigned_broker_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.brokers b WHERE b.id = c.assigned_broker_id);

-- 2) Foreign keys on clients for PostgREST embedding
ALTER TABLE public.clients
  ADD CONSTRAINT clients_search_city_id_fkey
    FOREIGN KEY (search_city_id) REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD CONSTRAINT clients_search_quarter_id_fkey
    FOREIGN KEY (search_quarter_id) REFERENCES public.quarters(id) ON DELETE SET NULL,
  ADD CONSTRAINT clients_assigned_broker_id_fkey
    FOREIGN KEY (assigned_broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;

-- 3) Owners: city
ALTER TABLE public.owners
  ADD COLUMN city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL;
CREATE INDEX idx_owners_city_id ON public.owners(city_id);

-- 4) Replace broker-RLS on clients to use brokers.user_id mapping
DROP POLICY IF EXISTS "clients broker assigned" ON public.clients;
CREATE POLICY "clients broker assigned"
  ON public.clients FOR ALL TO authenticated
  USING (
    assigned_broker_id IN (SELECT id FROM public.brokers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    assigned_broker_id IN (SELECT id FROM public.brokers WHERE user_id = auth.uid())
  );

-- 5) Broker tasks
CREATE TABLE public.broker_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'general', -- 'general' | 'message_client' | 'call_client' | 'meeting'
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  due_at timestamptz,
  auto_action_log jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broker_tasks TO authenticated;
GRANT ALL ON public.broker_tasks TO service_role;

ALTER TABLE public.broker_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_tasks admin all"
  ON public.broker_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "broker_tasks broker own"
  ON public.broker_tasks FOR ALL TO authenticated
  USING (broker_id IN (SELECT id FROM public.brokers WHERE user_id = auth.uid()))
  WITH CHECK (broker_id IN (SELECT id FROM public.brokers WHERE user_id = auth.uid()));

CREATE TRIGGER broker_tasks_set_updated_at
  BEFORE UPDATE ON public.broker_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_broker_tasks_broker ON public.broker_tasks(broker_id);
CREATE INDEX idx_broker_tasks_client ON public.broker_tasks(client_id);

-- 6) Extracted listings: agency-logo flag
ALTER TABLE public.extracted_listings
  ADD COLUMN agency_logo_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN agency_logo_reason text;
