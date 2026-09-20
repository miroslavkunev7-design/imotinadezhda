CREATE TABLE IF NOT EXISTS public.page_layouts (
  page_key TEXT PRIMARY KEY,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_layouts TO authenticated;
GRANT ALL ON public.page_layouts TO service_role;
ALTER TABLE public.page_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_layouts_public_read" ON public.page_layouts;
CREATE POLICY "page_layouts_public_read" ON public.page_layouts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "page_layouts_auth_manage" ON public.page_layouts;
CREATE POLICY "page_layouts_auth_manage" ON public.page_layouts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.page_layout_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL,
  sections JSONB NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_layout_revisions_page_key_created_at_idx ON public.page_layout_revisions (page_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_layout_revisions TO authenticated;
GRANT ALL ON public.page_layout_revisions TO service_role;
ALTER TABLE public.page_layout_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_layout_revisions_auth_manage" ON public.page_layout_revisions;
CREATE POLICY "page_layout_revisions_auth_manage" ON public.page_layout_revisions FOR ALL TO authenticated USING (true) WITH CHECK (true);