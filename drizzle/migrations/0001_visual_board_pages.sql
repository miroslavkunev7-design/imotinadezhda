CREATE TABLE IF NOT EXISTS public.visual_board_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL UNIQUE,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_by_name text,
  approved_at timestamptz,
  stage_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_percent numeric(5,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_board_pages TO authenticated;
GRANT ALL ON public.visual_board_pages TO service_role;

ALTER TABLE public.visual_board_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visual_board_pages_staff_all ON public.visual_board_pages;
CREATE POLICY visual_board_pages_staff_all ON public.visual_board_pages
  FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid()))
  WITH CHECK (public.is_crm_staff(auth.uid()));

DROP TRIGGER IF EXISTS visual_board_pages_set_updated_at ON public.visual_board_pages;
CREATE TRIGGER visual_board_pages_set_updated_at
  BEFORE UPDATE ON public.visual_board_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();