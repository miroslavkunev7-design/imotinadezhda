
-- Page backgrounds (admin-managed, global)
CREATE TABLE public.page_backgrounds (
  page_key TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_backgrounds TO anon, authenticated;
GRANT ALL ON public.page_backgrounds TO service_role;

ALTER TABLE public.page_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_backgrounds public read"
  ON public.page_backgrounds FOR SELECT
  USING (true);

CREATE POLICY "page_backgrounds admin write"
  ON public.page_backgrounds FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Per-user CRM background
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS crm_background_url TEXT;
