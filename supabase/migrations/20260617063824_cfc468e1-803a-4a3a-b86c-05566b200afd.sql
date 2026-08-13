
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_matches;

ALTER TABLE public.customer_chats REPLICA IDENTITY FULL;
ALTER TABLE public.customer_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.team_messages REPLICA IDENTITY FULL;
ALTER TABLE public.property_matches REPLICA IDENTITY FULL;

ALTER TABLE public.property_documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.client_documents   ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.generated_contracts ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE public.property_matches    ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_full_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','boss','head_broker','secretary')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_broker_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.brokers WHERE user_id = _user_id LIMIT 1;
$$;

DROP POLICY IF EXISTS "Authenticated can read clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Clients visible by access scope" ON public.clients;
DROP POLICY IF EXISTS "Clients writable by access scope" ON public.clients;

CREATE POLICY "Clients visible by access scope"
ON public.clients FOR SELECT TO authenticated
USING (
  public.is_full_access(auth.uid())
  OR assigned_broker_id = public.current_broker_id(auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "Clients writable by access scope"
ON public.clients FOR ALL TO authenticated
USING (
  public.is_full_access(auth.uid())
  OR assigned_broker_id = public.current_broker_id(auth.uid())
)
WITH CHECK (
  public.is_full_access(auth.uid())
  OR assigned_broker_id = public.current_broker_id(auth.uid())
);
