
-- Page Builder schema
CREATE TABLE public.page_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Дизайн',
  layout_json JSONB NOT NULL DEFAULT '{"blocks":[],"theme":{}}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_designs_slug_pub ON public.page_designs(page_slug, is_published);

GRANT SELECT ON public.page_designs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_designs TO authenticated;
GRANT ALL ON public.page_designs TO service_role;

ALTER TABLE public.page_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_designs public read published"
  ON public.page_designs FOR SELECT
  USING (is_published = true);

CREATE POLICY "page_designs admin all"
  ON public.page_designs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_page_designs_updated
  BEFORE UPDATE ON public.page_designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Revisions for undo history
CREATE TABLE public.design_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_design_id UUID NOT NULL REFERENCES public.page_designs(id) ON DELETE CASCADE,
  layout_json JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_revisions_design ON public.design_revisions(page_design_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.design_revisions TO authenticated;
GRANT ALL ON public.design_revisions TO service_role;

ALTER TABLE public.design_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_revisions admin all"
  ON public.design_revisions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User-saved component presets
CREATE TABLE public.component_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_type TEXT NOT NULL,
  name TEXT NOT NULL,
  props_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_presets TO authenticated;
GRANT ALL ON public.component_presets TO service_role;

ALTER TABLE public.component_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "component_presets admin all"
  ON public.component_presets FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_component_presets_updated
  BEFORE UPDATE ON public.component_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
