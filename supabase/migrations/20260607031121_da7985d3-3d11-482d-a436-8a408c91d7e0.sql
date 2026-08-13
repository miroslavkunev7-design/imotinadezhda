CREATE TABLE public.page_layout_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  sections jsonb NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.page_layout_revisions TO authenticated;
GRANT ALL ON public.page_layout_revisions TO service_role;

ALTER TABLE public.page_layout_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_layout_revisions admin all"
  ON public.page_layout_revisions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX page_layout_revisions_page_idx
  ON public.page_layout_revisions (page_key, created_at DESC);