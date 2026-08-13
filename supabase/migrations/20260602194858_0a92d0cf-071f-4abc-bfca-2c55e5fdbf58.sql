CREATE TABLE public.page_layouts (
  page_key text PRIMARY KEY,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_layouts TO authenticated;
GRANT ALL ON public.page_layouts TO service_role;

ALTER TABLE public.page_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_layouts public read"
  ON public.page_layouts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "page_layouts admin write"
  ON public.page_layouts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER page_layouts_set_updated_at
  BEFORE UPDATE ON public.page_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();