-- Details per archived property
ALTER TABLE public.archived_properties
  ADD COLUMN IF NOT EXISTS personal_description TEXT,
  ADD COLUMN IF NOT EXISTS personal_price NUMERIC,
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('archive-docs', 'archive-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "archive-docs admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'archive-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "archive-docs admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archive-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "archive-docs admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'archive-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "archive-docs admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'archive-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
