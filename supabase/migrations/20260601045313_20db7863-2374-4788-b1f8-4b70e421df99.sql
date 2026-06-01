
CREATE TABLE public.mortgage_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  employer text,
  monthly_income numeric,
  notes text,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mortgage_applications TO authenticated;
GRANT INSERT ON public.mortgage_applications TO anon;
GRANT ALL ON public.mortgage_applications TO service_role;

ALTER TABLE public.mortgage_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mortgage_applications anyone insert"
  ON public.mortgage_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "mortgage_applications admin all"
  ON public.mortgage_applications
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER mortgage_applications_set_updated_at
  BEFORE UPDATE ON public.mortgage_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Private bucket for mortgage documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('mortgage-docs', 'mortgage-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mortgage-docs anyone upload"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'mortgage-docs');

CREATE POLICY "mortgage-docs admin read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'mortgage-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "mortgage-docs admin delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'mortgage-docs' AND has_role(auth.uid(), 'admin'::app_role));
