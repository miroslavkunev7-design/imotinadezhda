
CREATE TABLE public.admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  user_id uuid,
  email text,
  ip text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_access_log TO authenticated;
GRANT ALL ON public.admin_access_log TO service_role;

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_access_log admin read"
  ON public.admin_access_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_access_log_created_at_idx ON public.admin_access_log (created_at DESC);
