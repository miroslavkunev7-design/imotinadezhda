CREATE TABLE IF NOT EXISTS public.visual_board_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  title text NOT NULL,
  detail text,
  position integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  done_by_name text,
  done_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visual_board_stages_route_idx ON public.visual_board_stages (route, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visual_board_stages TO authenticated;
GRANT ALL ON public.visual_board_stages TO service_role;

ALTER TABLE public.visual_board_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visual_board_stages_staff_all ON public.visual_board_stages;
CREATE POLICY visual_board_stages_staff_all ON public.visual_board_stages
  FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid()))
  WITH CHECK (public.is_crm_staff(auth.uid()));

-- Security: portal integration credentials must be staff-only
DROP POLICY IF EXISTS listing_portals_auth_all ON public.listing_portals;
CREATE POLICY listing_portals_staff_all ON public.listing_portals
  FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid()))
  WITH CHECK (public.is_crm_staff(auth.uid()));

-- Security: reviewer PII / unpublished reviews staff-only; public policy stays for published ones
DROP POLICY IF EXISTS reviews_auth_all ON public.reviews;
CREATE POLICY reviews_staff_all ON public.reviews
  FOR ALL TO authenticated
  USING (public.is_crm_staff(auth.uid()))
  WITH CHECK (public.is_crm_staff(auth.uid()));

DROP POLICY IF EXISTS reviews_published_read_auth ON public.reviews;
CREATE POLICY reviews_published_read_auth ON public.reviews
  FOR SELECT TO authenticated
  USING (is_public = true AND status = 'published');
