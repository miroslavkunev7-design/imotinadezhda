
CREATE TABLE public.cross_post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  site TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  external_url TEXT,
  error TEXT,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cross_post_queue TO authenticated;
GRANT ALL ON public.cross_post_queue TO service_role;

ALTER TABLE public.cross_post_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read" ON public.cross_post_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write" ON public.cross_post_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update" ON public.cross_post_queue FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_cross_post_queue_property ON public.cross_post_queue(property_id);
CREATE INDEX idx_cross_post_queue_status ON public.cross_post_queue(status);
